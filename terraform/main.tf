variable "aws_region" {
  type = string
}
variable "aws_profile" { type = string }
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}
variable "vm_size" { type = string }
variable "dns_host_zone" { type = string }
variable "http_only" { type = bool }
variable "vpc_id" { type = string }
variable "subnet_id" { type = string }
variable "tolocal_auth" { type = string }

variable "local_tunnels" {
  type = list(object({
    localport   = number
    proxyport   = number
    full_domain = string
  }))
}
variable "ssh_public_key_file_path" { type = string }
variable "ssh_private_key_file_path" { type = string }
variable "my_ip" { type = string }

# how to fetch the latest ubuntu ami:
# https://letslearndevops.com/2018/08/23/terraform-get-latest-centos-ami/
data "aws_ami" "latest-ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
      name   = "name"
      values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-20231025"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}
resource "aws_security_group" "tolocal_ec2" {
  name        = "tolocal-ec2"
  description = "Allow 80,443,22 inbound traffic"
  vpc_id      = var.vpc_id

  ingress {
    description = "TLS from Anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from Anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH from Anywhere"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "tolocal"
  }
}

resource "aws_instance" "ubuntu_1804" {
  ami                         = data.aws_ami.latest-ubuntu.id
  instance_type               = var.vm_size
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [aws_security_group.tolocal_ec2.id]
  associate_public_ip_address = true
  user_data = templatefile("${path.module}/user_data.sh.tpl",
    {
      local_tunnels = var.local_tunnels,
      public_key    = file(var.ssh_public_key_file_path)
      https_only    = var.http_only
      tolocal_auth  = var.tolocal_auth
  })
}

#################
###### DNS ######
#################
# what i learned here - var/string manipulations is not something terraform wants to do at all.
# at best, you can use some json natives like a datamap, if you want to write the config like that.
# variable "subdomains" {
#   description = "Subdomains"
#   type        = list(string)
#   default     = var.local_tunnels.map((e) => { return e.subdomain })
# }

# resource "aws_route53_zone" "main" {
#   name = "example.com"
# }

data "aws_route53_zone" "tld" {
  name = var.dns_host_zone
}

resource "aws_route53_record" "www" {
  for_each = toset([
    for domain in var.local_tunnels :
    domain.full_domain
  ])
  zone_id = data.aws_route53_zone.tld.zone_id
  name    = each.value
  # name =
  type    = "A"
  ttl     = "300"
  records = ["${aws_instance.ubuntu_1804.public_ip}"]
}

output "ubuntu_ip" { value = "ubuntu@${aws_instance.ubuntu_1804.public_ip}" }
