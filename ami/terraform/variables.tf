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

variable "baker_root_volume_size_gib" {
  type        = number
  description = "ルートボリュームサイズ（GiB）。未指定ならデフォルトのまま"
  default     = null
}

# variable "default_tags" {
#   type        = map(string)
#   description = "共通タグ"
#   default = {
#     Terraform = "true"
#   }
# }




#===== baker =====
variable "baker_version" { type = string }
# apply 時に一度だけビルドを走らせるか
variable "run_on_apply" {
  type        = bool
  description = "true で apply 時に 1 回だけ即時ビルド"
  default     = false
}
variable "skip_image_tests" {
  type        = bool
  default     = false
  description = "Image BuilderのImage tests（ビルド後テスト）をスキップする"
}
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
