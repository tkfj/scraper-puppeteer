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
  description = "project stage e.g. dev, prd, ..."
}

variable "ami_id" {
  type        = string
  description = "Windows AMI ID（例: Windows Server 2019/2022など）"
}

variable "instance_type" {
  type        = string
  description = "Instance type"
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


variable "deploy_env_secret_id" {
  type        = string
  description = "環境変数を補完しているSecretsMangerのID"
}
variable "deploy_project_base" {
  type        = string
  description = "デプロイ先ベースディレクトリ"
  default     = "C:/projects"
}
variable "deploy_project_name" {
  type        = string
  description = "デプロイ先ディレクトリ"
  default     = "scraper-puppeteer"
}
variable "deploy_git_command" {
  type        = string
  description = "デプロイgitコマンド"
  default     = "git clone https://github.com/tkfj/scraper-puppeteer.git"
}
variable "app_boot_command" {
  type        = string
  description = "アプリケーション起動コマンド"
  default     = "Start-Process node -ArgumentList \"apps/integrator/main.js\""
}
