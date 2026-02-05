# Retrieve shared resources from the global state file
data "terraform_remote_state" "global" {
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = var.global_state_key
    region = var.region
  }
}

data "terraform_remote_state" "shared" {
  backend = "s3"
  config = {
    bucket = var.state_bucket
    key    = var.shared_state_key
    region = var.region
  }
}

# Create new remote backend for local state file
# Note: backend configuration cannot use variables, so these values are hardcoded
terraform {
  backend "s3" {
    bucket = "jex-terraform-state"
    key    = "fab-test-backend/environments/dev/terraform.tfstate"
    region = "us-east-1"
  }
}