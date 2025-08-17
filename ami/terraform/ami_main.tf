terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    time = {
      source  = "hashicorp/time"
      version = ">= 0.10.0"
    }
  }
}

provider "aws" {
  # ★ グローバル環境を使わず、プロジェクト内ファイルだけを見る
  shared_credentials_files = [ "${path.module}/.aws_local/credentials" ]
  shared_config_files      = [ "${path.module}/.aws_local/config" ]
  profile                  = var.aws_profile

  # 明示したい場合は region も。config 側に書いてあれば省略可
  region = var.region
}

locals {
  time_suffix = replace(timestamp(), ":", "") # for names
}

############################
# IAM: Service Role (Image Builder) & Instance Profile (for build instance)
############################
resource "aws_iam_role" "imagebuilder_service" {
  name               = "ImageBuilderServiceRole"
  assume_role_policy = data.aws_iam_policy_document.imagebuilder_assume.json
}
data "aws_iam_policy_document" "imagebuilder_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["imagebuilder.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "imagebuilder_instance" {
  name               = "ImageBuilderBuildInstanceRole"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}
# SSM & ImageBuilder 用の最低限
resource "aws_iam_role_policy_attachment" "instance_imagebuilder" {
  role       = aws_iam_role.imagebuilder_instance.name
  policy_arn = "arn:aws:iam::aws:policy/EC2InstanceProfileForImageBuilder"
}
resource "aws_iam_role_policy_attachment" "instance_ssm" {
  role       = aws_iam_role.imagebuilder_instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
resource "aws_iam_instance_profile" "imagebuilder_instance" {
  name = "ImageBuilderBuildInstanceProfile"
  role = aws_iam_role.imagebuilder_instance.name
}



############################
# S3 Read (List/Get) for the whole bucket
############################
resource "aws_iam_role_policy" "imagebuilder_s3_read" {
  name = "ImageBuilderReadBakeBucket"
  role = aws_iam_role.imagebuilder_instance.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "ListBucket"
        Effect = "Allow"
        Action = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::${var.baker_script_s3_bucket}"
      },
      {
        Sid    = "GetObjects"
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = "arn:aws:s3:::${var.baker_script_s3_bucket}/*"
      }
    ]
  })
}


############################
# Image Builder Component (Windows build step)
############################
locals {
  awscli_installer_name = "AWSCLIV2.msi"
  awscli_installer_url  = "https://awscli.amazonaws.com/${local.awscli_installer_name}"
  nodejs_installer_name = "node-v${var.install_node_version}-${var.install_node_arch}.msi"
  nodejs_installer_url  = "https://nodejs.org/dist/v${var.install_node_version}/${local.nodejs_installer_name}"
  git_installer_name    = "Git-${var.install_git_version}-${var.install_git_arch}.exe"
  git_installer_url     = "https://github.com/git-for-windows/git/releases/download/v${var.install_git_version}.windows.1/${local.git_installer_name}"

  # 置換してからパース → 再エンコード（YAML妥当性チェックになる）
  baker_win_doc = yamldecode(templatefile(
    "${path.module}/amibuildsteps.yaml.tftpl",
    {
      awscli_installer_name = local.awscli_installer_name
      awscli_installer_url  = local.awscli_installer_url
      nodejs_installer_name = local.nodejs_installer_name
      nodejs_installer_url  = local.nodejs_installer_url
      git_installer_name    = local.git_installer_name
      git_installer_url     = local.git_installer_url
    }
  ))
}
resource "aws_imagebuilder_component" "baker_win" {
  name     = "${var.project}_${var.project_stage}_ami_baker"
  platform = "Windows"
  version  = var.baker_version
  data     = yamlencode(local.baker_win_doc)
}

resource "aws_imagebuilder_image_recipe" "recipe" {
  name     = "${var.project}_${var.project_stage}_ami_recipe"
  version  = var.baker_recipe_version
  parent_image = var.baker_parent_ami_id

  component {
    component_arn = aws_imagebuilder_component.baker_win.arn
  }
}

############################
# Infrastructure Configuration
############################
resource "aws_imagebuilder_infrastructure_configuration" "infra" {
  name                       = "imagebuilder-infra-${local.time_suffix}"
  instance_types             = [var.instance_type]
  subnet_id                  = var.baker_subnet_id
  security_group_ids         = var.baker_security_group_ids
  instance_profile_name      = aws_iam_instance_profile.imagebuilder_instance.name
  terminate_instance_on_failure = true
  key_pair                   = null

  # ビルドログの S3 出力をしたい場合（任意）
  # s3_logs {
  #   s3_bucket_name = "my-logs-bucket"
  #   s3_key_prefix  = "imagebuilder/"
  # }
  tags = { Purpose = "ami-bake" }
}

############################
# Distribution Configuration（このリージョンに AMI を配布）
############################
resource "aws_imagebuilder_distribution_configuration" "dist" {
  name = "imagebuilder-dist-${local.time_suffix}"

  distribution {
    region = var.region
    ami_distribution_configuration {
      # name        = "baked-${local.time_suffix}-{{imagebuilder:buildVersion}}"
      name        = "baked-{{ imagebuilder:buildDate }}-{{ imagebuilder:buildVersion }}"
            description = "Baked from xxxx"
      ami_tags = {
        Purpose = "ami-bake"
      }
      launch_permission {
        user_ids = [] # 共有不要なら空のまま
      }
    }
  }
}

############################
# Image Pipeline（手動キック／一度だけの即時ビルド）
############################
resource "aws_imagebuilder_image_pipeline" "pipeline" {
  name                             = "bake-from-lt-${local.time_suffix}"
  image_recipe_arn                 = aws_imagebuilder_image_recipe.recipe.arn
  infrastructure_configuration_arn = aws_imagebuilder_infrastructure_configuration.infra.arn
  distribution_configuration_arn   = aws_imagebuilder_distribution_configuration.dist.arn
  status                           = "ENABLED"

  schedule {
    schedule_expression = "cron(0 0 1 1 ? 1970)" # 事実上実行されないダミー（手動ビルド想定）
    pipeline_execution_start_condition = "EXPRESSION_MATCH_AND_DEPENDENCY_UPDATES_AVAILABLE"
  }

  tags = { Purpose = "ami-bake" }
}

# 即時ビルドを 1 回走らせる
resource "aws_imagebuilder_image" "onetime_build" {
  image_recipe_arn                 = aws_imagebuilder_image_recipe.recipe.arn
  infrastructure_configuration_arn = aws_imagebuilder_infrastructure_configuration.infra.arn
  distribution_configuration_arn   = aws_imagebuilder_distribution_configuration.dist.arn

  depends_on = [aws_imagebuilder_image_pipeline.pipeline]
}

############################
# Outputs
############################
output "baked_ami_id" {
  description = "作成された AMI の ID（Distribution 後の AMI）"
  value       = one(one(aws_imagebuilder_image.onetime_build.output_resources).amis).image
  # distribution先リージョンは１つに固定しているのでOneで取得
}
