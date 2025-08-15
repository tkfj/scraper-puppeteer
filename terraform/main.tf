terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
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

resource "aws_launch_template" "win_awscli" {
  name_prefix   = "${var.project}-win-awscli-"
  image_id      = var.ami_id
  instance_type = var.instance_type

  # 既存のキーペアを使う場合（不要なら null のまま）
  key_name = var.key_name

  # 既存のインスタンスプロファイル（ロール）を指定
  iam_instance_profile {
    name = var.iam_instance_profile_name
  }

  # 既存のセキュリティグループIDを配列で指定
  vpc_security_group_ids = var.security_group_ids

  # 起動時のサブネットは ASG 側や run-instances 側で指定する想定
  # ここでは Launch Template 側では固定しない（必要なら network_interfaces を使用）

  # ユーザーデータ（PowerShell）を base64 で投入
  user_data = filebase64("${path.module}/userdata.ps1")

  # 推奨: IMDSv2 有効化
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  # 推奨: 起動時のタグ
  tag_specifications {
    resource_type = "instance"
    tags = merge(
      var.default_tags,
      {
        "Name"    = "${var.project}-win-awscli"
        "Project" = var.project
      }
    )
  }

  tag_specifications {
    resource_type = "volume"
    tags = merge(
      var.default_tags,
      {
        "Project" = var.project
      }
    )
  }

  # 任意: ルートボリュームサイズを調整したい場合
  dynamic "block_device_mappings" {
    for_each = var.root_volume_size_gb == null ? [] : [1]
    content {
      device_name = "/dev/sda1"
      ebs {
        volume_size           = var.root_volume_size_gb
        volume_type           = "gp3"
        delete_on_termination = true
        encrypted             = true
      }
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

output "launch_template_id" {
  value = aws_launch_template.win_awscli.id
}

output "launch_template_latest_version" {
  value = aws_launch_template.win_awscli.latest_version
}
