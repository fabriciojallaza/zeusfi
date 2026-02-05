resource "aws_route53_record" "dev_api" {
  zone_id = data.terraform_remote_state.shared.outputs.route53_zone_id
  name    = var.dev_api_domain
  type    = "CNAME"
  ttl     = var.dns_record_ttl
  records = [aws_lb.dev.dns_name] # Apunta al DNS del ALB
}

resource "aws_acm_certificate" "dev_api_cert" {
  domain_name       = var.dev_api_domain
  validation_method = var.certificate_validation_method

  tags = {
    Name = "dev-api-cert"
  }
}
#
resource "aws_route53_record" "dev_api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.dev_api_cert.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }

  zone_id = data.terraform_remote_state.shared.outputs.route53_zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.value]
  ttl     = var.dns_record_ttl
}

resource "aws_acm_certificate_validation" "dev_api_cert_validation" {
  certificate_arn         = aws_acm_certificate.dev_api_cert.arn
  validation_record_fqdns = [for record in aws_route53_record.dev_api_cert_validation : record.fqdn]
}