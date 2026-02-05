# Use existing hosted zone instead of creating a new one
data "aws_route53_zone" "app_medical_tests_zone" {
  name         = var.domain_name
  private_zone = false
}
