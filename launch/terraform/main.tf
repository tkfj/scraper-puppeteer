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

resource "aws_launch_template" "server" {
  name_prefix   = "${var.project}_${var.project_stage}_server-"
  image_id      = var.ami_id
  instance_type = var.instance_type

  # 既存のキーペアを使う場合（不要なら null のまま）
  key_name = var.key_name

  # 既存のインスタンスプロファイル（ロール）を指定
  iam_instance_profile {
    name = var.iam_instance_profile_name #TODO 既存ではなく作成する
  }

  # 既存のセキュリティグループIDを配列で指定
  vpc_security_group_ids = var.security_group_ids #TODO 既存ではなく作成する

  # ユーザーデータ（PowerShell）を base64 で投入
  user_data = base64encode(templatefile("${path.module}/launchuserdata.ps1.xml.tftpl", {
    deploy_env_secret_id = aws_secretsmanager_secret.app_config.name
    deploy_project_base  = var.deploy_project_base
    deploy_project_name  = var.deploy_project_name
    deploy_git_command   = var.deploy_git_command
    app_boot_command     = var.app_boot_command
    cw_log_group_ec2launch    = var.cw_log_group_ec2launch
    cw_log_group_userdata_out = var.cw_log_group_userdata_out
    cw_log_group_userdata_err = var.cw_log_group_userdata_err
    cw_log_group_app_out      = var.cw_log_group_app_out
    cw_log_group_app_err      = var.cw_log_group_app_err
 }))

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
        "Name"    = "${var.project}-${var.project_stage}-server"
        "Project" = var.project
        "Stage" = var.project_stage
      }
    )
  }

  tag_specifications {
    resource_type = "volume"
    tags = merge(
      var.default_tags,
      {
        "Project" = var.project
        "Stage" = var.project_stage
      }
    )
  }

  # 任意: ルートボリュームサイズを調整したい場合
  dynamic "block_device_mappings" {
    for_each = var.root_volume_size_gb == null ? [] : [1]
    content {
      device_name = "/dev/sda1" #TODO デバイス名を親イメージから持ってくる(AMI作成処理参照)
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

data "aws_subnets" "all_in_vpc" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }
}

resource "aws_autoscaling_group" "asg" {
  name                      = "${var.project}_${var.project_stage}_asg"
  min_size                  = 0
  max_size                  = 1
  desired_capacity          = 0
  health_check_type         = "EC2"
  vpc_zone_identifier       = data.aws_subnets.all_in_vpc.ids #本来であればサブネットを個別に指定すべきだがとりあえずVPC内サブネットを全て指定
  launch_template {
    id      = aws_launch_template.server.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.project}_${var.project_stage}_asg-instance"
    propagate_at_launch = true
  }
 # 手動で一時的に desired を 1 に上げても plan を汚さない
  lifecycle {
    ignore_changes = [desired_capacity]
    precondition {
      condition     = length(data.aws_subnets.all_in_vpc.ids) > 0
      error_message = "指定の VPC にサブネットが見つかりません。VPC ID とサブネットを確認してください。"
    }
  }
}



output "launch_template_id" {
  value = aws_launch_template.server.id
}

output "launch_template_latest_version" {
  value = aws_launch_template.server.latest_version
}






############################
# SQS
############################
# DLQ
resource "aws_sqs_queue" "dlq" {
  name                      = "${var.project}_${var.project_stage}_sqs_dlq"
  message_retention_seconds = 1209600  # 14日
  sqs_managed_sse_enabled   = true     # 任意: SQS管理のSSEを有効化（古いproviderなら削除）
  tags = {
    Service = "myapp"
    Role    = "dlq"
  }
}
# Main queue (Standard)
resource "aws_sqs_queue" "main" {
  name                        = "${var.project}_${var.project_stage}_sqs_main"
  # Standardキューなので fifo_queue は未指定（= false）
  visibility_timeout_seconds  = 60      # ワーカー処理時間に合わせて調整
  receive_wait_time_seconds   = 20      # ロングポーリング（0〜20）
  sqs_managed_sse_enabled     = true    # 任意
  # DLQへの退避設定
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3             # 受信(可視化タイムアウト)失敗がこの回数を超えたらDLQへ
  })
  tags = {
    Service = "myapp"
    Role    = "main"
  }
}
# 参考: 出力
output "sqs_main" {
  value = {
    url = aws_sqs_queue.main.url
    arn = aws_sqs_queue.main.arn
  }
}

output "sqs_dlq" {
  value = {
    url = aws_sqs_queue.dlq.url
    arn = aws_sqs_queue.dlq.arn
  }
}


############################
# Auto Scaling Policies
############################
# スケールアウト（+1）
resource "aws_autoscaling_policy" "scale_out_on_sqs" {
  name                   = "${var.project}_${var.project_stage}-scale_out_on_sqs"
  autoscaling_group_name = aws_autoscaling_group.asg.name
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = 1
  cooldown               = 60
}
# スケールイン（-1）
resource "aws_autoscaling_policy" "scale_in_on_sqs_empty" {
  name                   = "${var.project}_${var.project_stage}-scale_in_on_sqs_empty"
  autoscaling_group_name = aws_autoscaling_group.asg.name
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = -1
  cooldown               = 60
}

############################
# CloudWatch Alarms
############################
# 1) 残存メッセージ数(可視) >= 1 でスケールアウト
resource "aws_cloudwatch_metric_alarm" "sqs_visible_ge1" {
  alarm_name          = "${aws_autoscaling_group.asg.name}-sqs-visible-ge1"
  alarm_description   = "ApproximateNumberOfMessagesVisible >= 1 triggers scale-out"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  period              = 60
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  dimensions = {
    QueueName = aws_sqs_queue.main.name
  }
  treat_missing_data = "notBreaching"
  alarm_actions      = [aws_autoscaling_policy.scale_out_on_sqs.arn]
}

# 2) （可視＋不可視）== 0 が続いたらスケールイン
#    -> metric math で合計を取り、0 以下で ALARM
resource "aws_cloudwatch_metric_alarm" "sqs_total_zero" {
  alarm_name          = "${aws_autoscaling_group.asg.name}-sqs-total-zero"
  alarm_description   = "Visible + NotVisible == 0 triggers scale-in"
  comparison_operator = "LessThanOrEqualToThreshold"
  threshold           = 0
  evaluation_periods  = 2          # 連続2分ゼロで判定（調整可）
  datapoints_to_alarm = 2
  treat_missing_data  = "notBreaching"

  metric_query {
    id = "m1"
    metric {
      metric_name = "ApproximateNumberOfMessagesVisible"
      namespace   = "AWS/SQS"
      period      = 60
      stat        = "Maximum"
      dimensions = {
        QueueName = aws_sqs_queue.main.name
      }
    }
  }

  metric_query {
    id = "m2"
    metric {
      metric_name = "ApproximateNumberOfMessagesNotVisible"
      namespace   = "AWS/SQS"
      period      = 60
      stat        = "Maximum"
      dimensions = {
        QueueName = aws_sqs_queue.main.name
      }
    }
  }

  metric_query {
    id          = "e1"
    expression  = "m1 + m2"
    label       = "TotalMessages"
    return_data = true
  }

  alarm_actions = [aws_autoscaling_policy.scale_in_on_sqs_empty.arn]
}


#####################################
# 固定メッセージ（必要に応じて変更）
#####################################
variable "scheduler_message" {
  type        = string
  default     = "DAILY_TRIGGER" # ここに固定メッセージ本文を入れる
  description = "EventBridge Scheduler から SQS へ送る固定メッセージ本文"
}

#####################################
# Scheduler → SQS 送信用 IAM ロール
#####################################
resource "aws_iam_role" "scheduler_to_sqs" {
  name = "${var.project}_${var.project_stage}_role-scheduler_to_sqs"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "scheduler.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}
resource "aws_iam_role_policy" "scheduler_to_sqs" {
  name = "${var.project}_${var.project_stage}_policy-scheduler_to_sqs_inline"
  role = aws_iam_role.scheduler_to_sqs.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = ["sqs:SendMessage"],
        Resource = aws_sqs_queue.main.arn
      }
    ]
  })
}

#####################################
# JST 0:00 & 8:00 に SQS へ送信
#####################################
resource "aws_scheduler_schedule" "daily_jst_00_08" {
  name = "${var.project}_${var.project_stage}_schedule-sqs_daily_00_08_jst"
  # JST指定で毎日 0時 と 8時（分=0）
  schedule_expression           = "cron(0 0,8 * * ? *)"
  schedule_expression_timezone  = "Asia/Tokyo"
  flexible_time_window {
    mode = "OFF"
  }
  target {
    arn      = aws_sqs_queue.main.arn
    role_arn = aws_iam_role.scheduler_to_sqs.arn
    input = "{\"key\":\"mf-aggregation_queue\"}"
    retry_policy {
      maximum_retry_attempts       = 3
      maximum_event_age_in_seconds = 3600
    }
  }
}

############################
# Secrets Manager: アプリ設定
############################
resource "aws_secretsmanager_secret" "app_config" {
  name        = "${var.project}/${var.project_stage}/env_1"  #TODO  削除はAWS側で即時ではなく不可視化＆スケジュールっぽいのでParamStoreに移行するまでは都度名前変更
  description = "App config: region & main SQS URL"
  recovery_window_in_days = 7
  tags = {
    Service = "myapp"
    Type    = "config"
  }
}
resource "aws_secretsmanager_secret_version" "app_config" {
  secret_id     = aws_secretsmanager_secret.app_config.id
  secret_string = jsonencode({
    SCRAPER_REGION   = var.region
    SCRAPER_READ_SQS = aws_sqs_queue.main.url
  })
}

output "app_config_secret_arn" {
  value = aws_secretsmanager_secret.app_config.arn
}



resource "aws_cloudwatch_log_group" "ec2launch" {
  name              = var.cw_log_group_ec2launch
  retention_in_days = 30
}
resource "aws_cloudwatch_log_group" "userdata_out" {
  name              = var.cw_log_group_userdata_out
  retention_in_days = 30
}
resource "aws_cloudwatch_log_group" "userdata_err" {
  name              = var.cw_log_group_userdata_err
  retention_in_days = 30
}
resource "aws_cloudwatch_log_group" "app_out" {
  name              = var.cw_log_group_app_out
  retention_in_days = 30
}
resource "aws_cloudwatch_log_group" "app_err" {
  name              = var.cw_log_group_app_err
  retention_in_days = 30
}

data "aws_iam_role" "target" {
  name = var.iam_instance_profile_name
}
data "aws_iam_policy_document" "secret_resource_policy" {
  statement {
    sid     = "AllowSpecificRoleRead"
    effect  = "Allow"
    actions = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]

    # 許可したいロール（同一 or 別アカウントいずれもOK）
    principals {
      type        = "AWS"
      identifiers = [data.aws_iam_role.target.arn]
    }

    # Secretのリソースポリシーでは通常 Resource="*"
    resources = ["*"]
  }
}

resource "aws_secretsmanager_secret_policy" "this" {
  secret_arn = aws_secretsmanager_secret.app_config.arn
  policy     = data.aws_iam_policy_document.secret_resource_policy.json
}

data "aws_iam_policy_document" "queue_policy" {
  statement {
    sid     = "AllowRoleConsume"
    effect  = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:ChangeMessageVisibility",
      "sqs:GetQueueAttributes",
    ]
    principals {
      type        = "AWS"
      identifiers = [data.aws_iam_role.target.arn]
    }
    resources = [aws_sqs_queue.main.arn]
  }
}

resource "aws_sqs_queue_policy" "this" {
  queue_url = aws_sqs_queue.main.url
  policy    = data.aws_iam_policy_document.queue_policy.json
}
