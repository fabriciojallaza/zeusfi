variable "project_name" {
  description = "Project name to use in resource names"
  type        = string
}

variable "aws_lb_listener_port" {
  description = "AWS load balancer listener port"
  type        = number
}

variable "aws_lb_listener_protocol" {
  description = "AWS load balancer listener protocol"
  type        = string
}

variable "instance_type" {
  description = "Instance type for the EC2 instance"
  type        = string
}

variable "key_name" {
  description = "Key pair name for EC2 access"
  type        = string
}

variable "ami_id" {
  description = "AMI ID for the Ubuntu 22.04 instance ARM"
  type        = string
}

variable "region" {
  description = "The AWS region to create resources in"
  type        = string
}

variable "provider_name" {
  description = "AWS profile name to use for provider"
  type        = string
}

# Variables para remote_state
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

variable "dev_state_key" {
  description = "S3 key for dev environment terraform state"
  type        = string
}

# Variables para alb.tf
variable "alb_target_group_port" {
  description = "Port for ALB target group"
  type        = number
}

variable "alb_target_group_protocol" {
  description = "Protocol for ALB target group"
  type        = string
}

variable "health_check_path" {
  description = "Health check path for ALB target group"
  type        = string
}

variable "health_check_protocol" {
  description = "Health check protocol for ALB target group"
  type        = string
}

variable "health_check_interval" {
  description = "Health check interval for ALB target group"
  type        = number
}

variable "health_check_timeout" {
  description = "Health check timeout for ALB target group"
  type        = number
}

variable "health_check_healthy_threshold" {
  description = "Health check healthy threshold for ALB target group"
  type        = number
}

variable "health_check_unhealthy_threshold" {
  description = "Health check unhealthy threshold for ALB target group"
  type        = number
}

variable "http_port" {
  description = "HTTP port for ALB listener"
  type        = number
}

variable "https_port" {
  description = "HTTPS port for ALB listener"
  type        = number
}

variable "http_protocol" {
  description = "HTTP protocol for ALB listener"
  type        = string
}

variable "https_protocol" {
  description = "HTTPS protocol for ALB listener"
  type        = string
}

# Variables para dns.tf
variable "dev_api_domain" {
  description = "Domain name for dev API"
  type        = string
}

variable "dns_record_ttl" {
  description = "TTL for DNS records"
  type        = number
}

variable "certificate_validation_method" {
  description = "Validation method for ACM certificate"
  type        = string
}

# Variables para ec2.tf
variable "ec2_volume_size" {
  description = "Size of EC2 root volume in GB"
  type        = number
}

variable "ec2_volume_type" {
  description = "Type of EC2 root volume"
  type        = string
}

variable "ssh_email" {
  description = "Email for SSH key comment"
  type        = string
}

# Variables para securitygroups.tf
variable "ssh_port" {
  description = "SSH port for security group"
  type        = number
}

variable "all_traffic_protocol" {
  description = "Protocol value for all traffic"
  type        = string
}

variable "tcp_protocol" {
  description = "Protocol value for TCP traffic"
  type        = string
}

variable "open_cidr_block" {
  description = "CIDR block for open access"
  type        = string
}

# Variables para s3.tf
variable "aws_provider_version" {
  description = "Version of AWS provider"
  type        = string
}

variable "s3_environment_suffix" {
  description = "Environment suffix for S3 bucket"
  type        = string
}

variable "cors_max_age" {
  description = "Max age for CORS rules in seconds"
  type        = number
}

variable "s3_object_ownership" {
  description = "Object ownership setting for S3 bucket"
  type        = string
}

# Variables para cloudwatch.tf
variable "cloudwatch_logs_retention" {
  description = "Retention period for CloudWatch logs in days"
  type        = number
}
