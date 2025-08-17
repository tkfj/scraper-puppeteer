variable "region"                           { type = string }
variable "image_recipe_arn"                 { type = string }
variable "infrastructure_configuration_arn" { type = string }
variable "distribution_configuration_arn"   { type = string }
variable "image_tests_enabled"              { type = bool   }

# 即時ビルドを 1 回走らせる
resource "aws_imagebuilder_image" "onetime_build" {
  image_recipe_arn                 = var.image_recipe_arn
  infrastructure_configuration_arn = var.infrastructure_configuration_arn
  distribution_configuration_arn   = var.distribution_configuration_arn
  image_tests_configuration {
    image_tests_enabled = var.image_tests_enabled
  }
}

output "baked_ami_id" {
  description = "作成された AMI の ID（Distribution 後の AMI）"
  value       = one([
    for a in one(aws_imagebuilder_image.onetime_build.output_resources).amis : a.image if a.region == var.region
  ])
  # distribution先リージョンは１つに固定しているのでOneで取得
}
