variable "aws_profile" {
  type        = string
  description = "利用する AWS プロファイル名（.aws_local/config / credentials と一致）"
}

variable "region" {
  type        = string
  description = "AWS region"
}

variable "project" {
  type        = string
  description = "Tag/Name prefix"
}

variable "project_stage" {
  type        = string
  description = "Project stage e.g. prd, dev, ..."
}
variable "baker_vpc_id" {
  type = string
}

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
variable "image_tests_enabled" {
  type        = bool
  default     = true
  description = "Image BuilderのImage tests（ビルド後テスト）を実行する"
}
# 重い初期化処理をAMIイメージに焼く
variable "baker_parent_ami_id" {
  description = "ベースにするAMI"
}
variable "baker_subnet_id" {
  description = "ビルド用インスタンスを起動する Subnet（NAT 越しにインターネットへ出られること）"
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
