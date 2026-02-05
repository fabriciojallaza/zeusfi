resource "aws_cloudwatch_log_group" "dev_logs" {
  name              = var.dev_logs_name
  retention_in_days = var.dev_retention_days
}

resource "aws_cloudwatch_log_group" "prod_logs" {
  name              = var.prod_logs_name
  retention_in_days = var.prod_retention_days
}

output "dev_logs_group_arn" {
  description = "CloudWatch Log Group ARN for the dev environment"
  value       = aws_cloudwatch_log_group.dev_logs.arn
}

output "prod_logs_group_arn" {
  description = "CloudWatch Log Group ARN for the prod environment"
  value       = aws_cloudwatch_log_group.prod_logs.arn
}

output "dev_logs_group" {
  description = "CloudWatch Log Group for the dev environment"
  value       = aws_cloudwatch_log_group.dev_logs.name
}

output "prod_logs_group" {
  description = "CloudWatch Log Group for the prod environment"
  value       = aws_cloudwatch_log_group.prod_logs.name
}