output "alb_dns_name" {
  value       = aws_lb.dev.dns_name
  description = "DNS name of the Application Load Balancer"
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.project_bucket.bucket
  description = "Name of the S3 bucket"
}

output "alb_sg_id" {
  value       = aws_security_group.alb_sg.id
  description = "Security Group ID for ALB"
}

output "instance_id" {
  value       = aws_instance.ec2.id
  description = "EC2 instance ID"
}

output "ec2_public_ip" {
  value       = aws_instance.ec2.public_ip
  description = "Public IP address of the EC2 instance"
}

# output "ses_campaign_v1_name" {
#   value = aws_sesv2_configuration_set.config_set.configuration_set_name
#   description = "Name of the SES configuration set"
# }