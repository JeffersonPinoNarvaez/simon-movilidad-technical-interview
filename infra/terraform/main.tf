terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region for FleetPortal deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "staging"
}

variable "project_name" {
  description = "Project name prefix for resources"
  type        = string
  default     = "fleetportal"
}

# VPC stub
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-vpc"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${count.index + 1}"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# ECS cluster stub
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Project = var.project_name
  }
}

# RDS placeholder (TimescaleDB would run on EC2 or use managed Postgres + extension)
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet"
  subnet_ids = aws_subnet.public[*].id

  tags = {
    Name = "${var.project_name} DB subnet group"
  }
}

resource "aws_db_instance" "timescale_placeholder" {
  identifier             = "${var.project_name}-${var.environment}-db"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t3.medium"
  allocated_storage      = 50
  db_name                = "fleetportal"
  username               = "fleet"
  password               = "CHANGE_ME_IN_SECRETS_MANAGER"
  db_subnet_group_name   = aws_db_subnet_group.main.name
  skip_final_snapshot    = true
  publicly_accessible    = false

  tags = {
    Note = "Replace with TimescaleDB on EC2 or Timescale Cloud for production"
  }
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "rds_endpoint" {
  value = aws_db_instance.timescale_placeholder.endpoint
}
