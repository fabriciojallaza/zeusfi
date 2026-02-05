# Valores generales del proyecto
project_name = "fab-test"

# Configuración de estado remoto
state_bucket     = "jex-terraform-state"
global_state_key = "global/infrastructure/terraform.tfstate"
shared_state_key = "fab-test-backend/shared/terraform.tfstate"
region           = "us-east-1"

# Configuración de ECS
cluster_name = "fab-test-prod"

# Configuración de Route53
domain_name = "internal.jexhq.com"

# Configuración de CloudWatch
dev_logs_name       = "/fab-test/dev/logs"
prod_logs_name      = "/fab-test/prod/logs"
dev_retention_days  = 30
prod_retention_days = 365

# Políticas de IAM
ecs_task_execution_policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
xray_policy_arn               = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
