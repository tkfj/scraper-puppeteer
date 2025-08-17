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
  region                   = var.region
}

locals {
  time_suffix = replace(timestamp(), ":", "") # for names
  baker_version_us = replace(var.baker_version, ".", "_") # _区切りのバージョン表記(.を使えない名前やIDで使用)
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

data "aws_ami" "baker_parent_ami" {
  filter {
    name   = "image-id"
    values = [var.baker_parent_ami_id]
  }
}
resource "aws_imagebuilder_image_recipe" "recipe" {
  name     = "${var.project}_${var.project_stage}_ami_baker_recipe"
  version  = var.baker_version
  parent_image = var.baker_parent_ami_id

  dynamic block_device_mapping {
    for_each = var.baker_root_volume_size_gib == null ? [] : [1]
    content {
      device_name = data.aws_ami.baker_parent_ami.root_device_name
      ebs {
        volume_size = var.baker_root_volume_size_gib
      }
    }
  }
  component {
    component_arn = aws_imagebuilder_component.baker_win.arn
  }
}

############################
# Infrastructure Configuration
############################
resource "aws_imagebuilder_infrastructure_configuration" "infra" {
  name                       = "${var.project}_${var.project_stage}_ami_baker_infra-${local.baker_version_us}"
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
  name = "${var.project}_${var.project_stage}_ami_baker_dist-${local.baker_version_us}"

  distribution {
    region = var.region
    ami_distribution_configuration {
      # name        = "baked-${local.time_suffix}-{{imagebuilder:buildVersion}}"
      name        = "${var.project}_${var.project_stage}_ami_baked-{{ imagebuilder:buildVersion }}-{{ imagebuilder:buildDate }}"
      # description = "Baked from xxxx"
      # ami_tags = {
      #   Purpose = "ami-bake"
      # }
      # launch_permission {
      #   user_ids = [] # 共有不要なら空のまま
      # }
    }
  }
}

############################
# Image Pipeline（手動キック／一度だけの即時ビルド）
############################
resource "aws_imagebuilder_image_pipeline" "pipeline" {
  name                             = "${var.project}_${var.project_stage}_ami_baker-${local.baker_version_us}"
  image_recipe_arn                 = aws_imagebuilder_image_recipe.recipe.arn
  infrastructure_configuration_arn = aws_imagebuilder_infrastructure_configuration.infra.arn
  distribution_configuration_arn   = aws_imagebuilder_distribution_configuration.dist.arn
  status                           = "ENABLED"

  image_tests_configuration {
    image_tests_enabled = !var.skip_image_tests
  }
  tags = { Purpose = "ami-bake" }
}

# 即時ビルドを 1 回走らせる
module "onetime_build" {
  count = var.run_on_apply ? 1 : 0
  source = "./modules/onetime_build"
  region = var.region
  image_recipe_arn                 = aws_imagebuilder_image_recipe.recipe.arn
  infrastructure_configuration_arn = aws_imagebuilder_infrastructure_configuration.infra.arn
  distribution_configuration_arn   = aws_imagebuilder_distribution_configuration.dist.arn
}
