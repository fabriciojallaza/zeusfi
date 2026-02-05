variable "project_name" {
  description = "Project name to use in resource names"
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