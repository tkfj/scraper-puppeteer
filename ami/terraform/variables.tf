variable "aws_profile" {
  type        = string
  description = "利用する AWS プロファイル名（.aws_local/config / credentials と一致）"
  default     = "myprofile"
}

variable "region" {
  type        = string
  description = "AWS region"
  default     = "ap-northeast-1"
}

variable "project" {
  type        = string
  description = "Tag/Name prefix"
  default     = "scrpu"
}

variable "project_stage" {
  type        = string
  description = "Project stage e.g. prd, dev, ..."
  default     = "dev"
}

# variable "ami_id" {
#   type        = string
#   description = "Windows AMI ID（例: Windows Server 2019/2022など）"
# }

variable "instance_type" {
  type        = string
  description = "Instance type"
  default     = "t3.large"
}

# variable "key_name" {
#   type        = string
#   description = "既存のキーペア名（不要なら空に）"
#   default     = null
# }

# variable "iam_instance_profile_name" {
#   type        = string
#   description = "既存のインスタンスプロファイル名（例: EC2SSMRole）"
# }

# variable "security_group_ids" {
#   type        = list(string)
#   description = "既存のセキュリティグループIDの配列"
# }

# variable "root_volume_size_gb" {
#   type        = number
#   description = "ルートボリュームサイズ（GB）。未指定ならデフォルトのまま"
#   default     = 30
# }

# variable "default_tags" {
#   type        = map(string)
#   description = "共通タグ"
#   default = {
#     Terraform = "true"
#   }
# }




#===== baker =====
variable "baker_version" { type = string }
variable "baker_recipe_version" { type = string }

# 重い初期化処理をAMIイメージに焼く
variable "baker_parent_ami_id" {
  description = "ベースにするAMI"
}
variable "baker_subnet_id" {
  description = "ビルド用インスタンスを起動する Subnet（NAT 越しにインターネットへ出られること）"
}
variable "baker_security_group_ids" {
  type        = list(string)
  description = "ビルド用インスタンスに付与する SG"
}
variable "baker_instance_type" {
  default     = "m6i.large"
  description = "ビルド用インスタンスタイプ（処理に応じて上げる）"
}
variable "baker_script_s3_bucket" {
  description = "ユーザーデータ(スクリプト)を置いている既存S3バケット名"
  type        = string
}
variable "baker_script_s3_fullpath" {
  description = "重いユーザーデータ相当のビルドスクリプト（PowerShell）の S3 パス。例: s3://my-bucket/bake/setup.ps1"
}

variable "install_node_version" {
  description = "node.js インストーラのバージョン"
}
variable "install_node_arch" {
  description = "node.js インストーラのアーキテクチャ(x64など)"
}
variable "install_git_version" {
  description = "git インストーラのバージョン"
}
variable "install_git_arch" {
  description = "git インストーラのアーキテクチャ(x64など)"
}
