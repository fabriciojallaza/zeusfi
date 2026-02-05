output "route53_zone_id" {
  value = data.aws_route53_zone.app_medical_tests_zone.zone_id
}

output "route53_name_servers" {
  value = data.aws_route53_zone.app_medical_tests_zone.name_servers
}
