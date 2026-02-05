data "terraform_remote_state" "global" {
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = var.global_state_key
    region = var.region
  }
}

module "route53" {
  source      = "./modules/route53"
  domain_name = var.domain_name
}

module "cloudwatch" {
  source             = "./modules/cloudwatch"
  project_name       = var.project_name
  dev_logs_name      = var.dev_logs_name
  prod_logs_name     = var.prod_logs_name
  dev_retention_days = var.dev_retention_days
  prod_retention_days = var.prod_retention_days
}

terraform {
  backend "s3" {
    bucket         = "jex-terraform-state"
    key            = "fab-test-backend/shared/terraform.tfstate"
    region         = "us-east-1"
  }
}

output "route53_zone_id" {
  value = module.route53.route53_zone_id
}
output "route53_name_servers" {
  value = module.route53.route53_name_servers
}

output "dev_logs_group_arn" {
  description = "CloudWatch Log Group ARN for the dev environment"
  value       = module.cloudwatch.dev_logs_group_arn
}

output "prod_logs_group_arn" {
  description = "CloudWatch Log Group ARN for the prod environment"
  value       = module.cloudwatch.prod_logs_group_arn
}

output "dev_logs_group" {
  description = "CloudWatch Log Group for the dev environment"
  value       = module.cloudwatch.dev_logs_group
}

output "prod_logs_group" {
  description = "CloudWatch Log Group for the prod environment"
  value       = module.cloudwatch.prod_logs_group
}