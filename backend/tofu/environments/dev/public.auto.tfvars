# Valores generales del proyecto
project_name  = "fab-test-backend"
region        = "us-east-1"
provider_name = "default"

# Configuración de instancia EC2
instance_type = "t4g.medium"
key_name      = "general-repo-key"
ami_id        = "ami-07ee04759daf109de"

# Configuración de Load Balancer
aws_lb_listener_port     = 443
aws_lb_listener_protocol = "HTTPS"
http_port                = 80
https_port               = 443
http_protocol            = "HTTP"
https_protocol           = "HTTPS"

# Configuración del Target Group
alb_target_group_port     = 8000
alb_target_group_protocol = "HTTP"

# Configuración de Health Check
health_check_path                = "/api/v1/parameters/health/"
health_check_protocol            = "HTTP"
health_check_interval            = 60
health_check_timeout             = 5
health_check_healthy_threshold   = 2
health_check_unhealthy_threshold = 2

# Configuración de DNS
dev_api_domain                = "api.fab-test.internal.jexhq.com"
dns_record_ttl                = 300
certificate_validation_method = "DNS"

# Configuración de EC2 volumen
ec2_volume_size = 30
ec2_volume_type = "gp3"
ssh_email       = "dev@jexhq.com"

# Configuración de Security Groups
ssh_port             = 22
tcp_protocol         = "tcp"
all_traffic_protocol = "-1"
open_cidr_block      = "0.0.0.0/0"

# Configuración S3
aws_provider_version  = "5.81.0"
s3_environment_suffix = "development"
cors_max_age          = 3000
s3_object_ownership   = "BucketOwnerPreferred"

# Configuración CloudWatch
cloudwatch_logs_retention = 365

# Configuración Remote State
state_bucket     = "jex-terraform-state"
global_state_key = "global/infrastructure/terraform.tfstate"
shared_state_key = "fab-test-backend/shared/terraform.tfstate"
dev_state_key    = "fab-test-backend/environments/dev/terraform.tfstate"
