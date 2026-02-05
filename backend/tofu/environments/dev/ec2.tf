resource "aws_instance" "ec2" {
  ami                         = var.ami_id
  instance_type               = var.instance_type
  subnet_id                   = data.terraform_remote_state.global.outputs.public_subnet_ids[0]
  vpc_security_group_ids      = [aws_security_group.ec2_sg.id]
  key_name                    = var.key_name
  associate_public_ip_address = true
  iam_instance_profile        = data.aws_iam_instance_profile.ec2_logs_profile.name

  user_data = <<-EOF
    #!/bin/bash
    sudo apt update -y
    for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do sudo apt-get remove $pkg -y; done

    sudo apt update -y
    sudo apt install ca-certificates curl gnupg lsb-release -y
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update

    # Install Docker
    sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y

    # Add user to Docker group
    sudo groupadd docker
    sudo usermod -aG docker ubuntu

    # Activate the changes to the group membership (use when you are logged in as the user)
    # newgrp docker

    # Switch to 'ubuntu' user and execute commands
    su - ubuntu <<EOF2
    # Generate SSH keys
    ssh-keygen -t rsa -b 4096 -C "${var.ssh_email}" -f ~/.ssh/id_rsa -N ""

    # Start the SSH agent and add the key
    eval \$(ssh-agent -s)
    ssh-add ~/.ssh/id_rsa

    # Ensure correct permissions for the '.ssh' directory
    chmod 700 ~/.ssh
    chmod 600 ~/.ssh/id_rsa
    chmod 644 ~/.ssh/id_rsa.pub
    EOF2
  EOF

  # Root Volume
  root_block_device {
    volume_size           = var.ec2_volume_size
    volume_type           = var.ec2_volume_type
    delete_on_termination = true
  }

  tags = {
    Name = "${var.project_name}-dev-ec2"
  }

  lifecycle {
    ignore_changes = [user_data]
  }
}

# Se eliminó el recurso EIP siguiendo el patrón de evitar usar eip para dev
# y en su lugar usar dns asociado a la alb