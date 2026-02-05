# alb
resource "aws_security_group" "alb_sg" {
  name        = "${var.project_name}-dev-alb-sg"
  description = "Allow HTTP and HTTPS traffic"
  vpc_id      = data.terraform_remote_state.global.outputs.vpc_id

  ingress {
    from_port   = var.http_port
    to_port     = var.http_port
    protocol    = var.tcp_protocol
    cidr_blocks = [var.open_cidr_block]
  }

  ingress {
    from_port   = var.https_port
    to_port     = var.https_port
    protocol    = var.tcp_protocol
    cidr_blocks = [var.open_cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = var.all_traffic_protocol
    cidr_blocks = [var.open_cidr_block]
  }
}

# ec2
resource "aws_security_group" "ec2_sg" {
  name        = "${var.project_name}-dev-ec2-sg"
  description = "Allow traffic from ALB"
  vpc_id      = data.terraform_remote_state.global.outputs.vpc_id

  ingress {
    from_port       = var.alb_target_group_port
    to_port         = var.alb_target_group_port
    protocol        = var.tcp_protocol
    security_groups = [aws_security_group.alb_sg.id]
  }

  ingress {
    from_port   = var.ssh_port
    to_port     = var.ssh_port
    protocol    = var.tcp_protocol
    cidr_blocks = [var.open_cidr_block]
    description = "Allow SSH access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = var.all_traffic_protocol
    cidr_blocks = [var.open_cidr_block]
  }
}