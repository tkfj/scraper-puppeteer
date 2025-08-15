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

variable "ami_id" {
  type        = string
  description = "Windows AMI ID（例: Windows Server 2019/2022など）"
}

variable "instance_type" {
  type        = string
  description = "Instance type"
  default     = "t3.large"
}

variable "key_name" {
  type        = string
  description = "既存のキーペア名（不要なら空に）"
  default     = null
}

variable "iam_instance_profile_name" {
  type        = string
  description = "既存のインスタンスプロファイル名（例: EC2SSMRole）"
}

variable "security_group_ids" {
  type        = list(string)
  description = "既存のセキュリティグループIDの配列"
}

variable "root_volume_size_gb" {
  type        = number
  description = "ルートボリュームサイズ（GB）。未指定ならデフォルトのまま"
  default     = 30
}

variable "default_tags" {
  type        = map(string)
  description = "共通タグ"
  default = {
    Terraform = "true"
  }
}
