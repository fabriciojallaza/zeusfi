variable "project_name" {
  description = "Project name to use in resource names"
  type        = string
}

variable "state_bucket" {
  description = "S3 bucket name for terraform state"
  type        = string
}

variable "global_state_key" {
  description = "S3 key for global terraform state"
  type        = string
}

variable "shared_state_key" {
  description = "S3 key for shared terraform state"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "domain_name" {
  description = "Domain name for Route53"
  type        = string
}

variable "dev_logs_name" {
  description = "CloudWatch Log Group name for the dev environment"
  type        = string
}

variable "prod_logs_name" {
  description = "CloudWatch Log Group name for the prod environment"
  type        = string
}

variable "dev_retention_days" {
  description = "CloudWatch Log Group retention in days for the dev environment"
  type        = number
}

variable "prod_retention_days" {
  description = "CloudWatch Log Group retention in days for the prod environment"
  type        = number
}

# Nuevas variables para políticas de IAM que se usaban en el módulo ECS
variable "ecs_task_execution_policy_arn" {
  description = "ARN of the ECS task execution policy"
  type        = string
}

variable "xray_policy_arn" {
  description = "ARN of the X-Ray daemon write access policy"
  type        = string
}