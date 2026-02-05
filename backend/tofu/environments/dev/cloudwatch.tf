# resource "aws_cloudwatch_log_group" "aws_waf_log_group" {
#   name              = "aws-waf-logs-${var.project_name}"
#   retention_in_days = var.cloudwatch_logs_retention
# }

# CloudWatch Alarm for unhealthy hosts in ALB target group
resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "${var.project_name}-dev-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "${var.project_name} dev service unhealthy - one or more targets failing health checks | https://${var.dev_api_domain}/api/v1/parameters/health/"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = aws_lb_target_group.dev_backend.arn_suffix
    LoadBalancer = aws_lb.dev.arn_suffix
  }

  alarm_actions = [data.terraform_remote_state.global.outputs.sns_dev_alerts_arn]
  ok_actions    = [data.terraform_remote_state.global.outputs.sns_dev_alerts_arn]

  tags = {
    Name        = "${var.project_name}-dev-unhealthy-hosts"
    Environment = "dev"
  }
}

output "cloudwatch_alarm_name" {
  description = "Name of the unhealthy hosts CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.unhealthy_hosts.alarm_name
}
