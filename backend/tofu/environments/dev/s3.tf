terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.81.0" # Hardcoded because provider versions cannot use variables
    }
  }
}
# create a bucket for the project
resource "aws_s3_bucket" "project_bucket" {
  bucket = "${var.project_name}-${var.s3_environment_suffix}"


  tags = {
    Name        = "${var.project_name}-${var.s3_environment_suffix}"
    Environment = var.s3_environment_suffix
  }
}

resource "aws_s3_bucket_cors_configuration" "project_bucket_cors" {
  bucket = aws_s3_bucket.project_bucket.bucket

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "POST"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = var.cors_max_age
  }
}

# configure acl
resource "aws_s3_bucket_public_access_block" "project_bucket_acl" {
  bucket = aws_s3_bucket.project_bucket.bucket

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_ownership_controls" "project_bucket_ownership" {
  bucket = aws_s3_bucket.project_bucket.id
  rule {
    object_ownership = var.s3_object_ownership
  }
}
