resource "aws_lb" "dev" {
  name               = "${var.project_name}-dev-lb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = data.terraform_remote_state.global.outputs.public_subnet_ids

  tags = {
    Name = "${var.project_name}-dev-alb"
  }
}

resource "aws_lb_target_group" "dev_backend" {
  name        = "${var.project_name}-dev-tg"
  port        = var.alb_target_group_port
  protocol    = var.alb_target_group_protocol
  vpc_id      = data.terraform_remote_state.global.outputs.vpc_id
  target_type = "instance"

  health_check {
    path                = var.health_check_path
    protocol            = var.health_check_protocol
    interval            = var.health_check_interval
    timeout             = var.health_check_timeout
    healthy_threshold   = var.health_check_healthy_threshold
    unhealthy_threshold = var.health_check_unhealthy_threshold
  }
}

# HTTPS listener con certificado ACM
resource "aws_lb_listener" "https_listener" {
  load_balancer_arn = aws_lb.dev.arn
  port              = var.https_port
  protocol          = var.https_protocol
  certificate_arn   = aws_acm_certificate_validation.dev_api_cert_validation.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.dev_backend.arn
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.dev.arn
  port              = var.http_port
  protocol          = var.http_protocol

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.dev_backend.arn
  }
}

# ec2 instances
resource "aws_lb_target_group_attachment" "dev_ec2" {
  target_group_arn = aws_lb_target_group.dev_backend.arn
  target_id        = aws_instance.ec2.id
  port             = var.alb_target_group_port
}