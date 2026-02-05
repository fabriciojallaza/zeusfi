# Reference the existing IAM instance profile from global state
data "aws_iam_instance_profile" "ec2_logs_profile" {
  name = data.terraform_remote_state.global.outputs.ec2_logs_instance_profile_name
}

