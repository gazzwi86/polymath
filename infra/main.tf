terraform {
  backend "s3" {
    key            = "tech-radar-invite-agent/terraform.tfstate"
    region         = "ap-southeast-2"
    bucket         = "polymath-tf-state-lock"
    use_lockfile = true
    encrypt        = true
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
  required_version = ">= 1.3.0"
}

provider "aws" {
  region = var.aws_region
}

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr_block

  tags = {
    Name = var.vpc_name
  }
}

resource "aws_ecr_repository" "this" {
  name = var.ecr_repo_name
}

resource "aws_ecs_cluster" "this" {
  name = var.ecs_cluster_name
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "ecsTaskExecutionRole"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_policy" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "ecsTaskRole"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.ecs_task_family
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions    = jsonencode([
    {
      name      = var.ecs_task_name
      image     = aws_ecr_repository.this.repository_url
      essential = true
      environment = [
        { name = "OLLAMA_HOST", value = var.ollama_host },
        { name = "OLLAMA_MODEL", value = var.ollama_model },
        { name = "EVALUATOR_MODEL", value = var.evaluator_model },
        { name = "GOOGLE_API_KEY", value = var.google_api_key },
        { name = "GOOGLE_MODEL", value = var.google_model },
        { name = "BEDROCK_REGION", value = var.bedrock_region },
        { name = "BEDROCK_MODEL_ID", value = var.bedrock_model_id },
        { name = "BEDROCK_ACCESS_KEY", value = var.bedrock_access_key },
        { name = "BEDROCK_SECRET_KEY", value = var.bedrock_secret_key },
        { name = "LANGSMITH_API_KEY", value = var.langsmith_api_key },
        { name = "LANGSMITH_TRACING", value = var.langsmith_tracing },
        { name = "LANGSMITH_ENDPOINT", value = var.langsmith_endpoint },
        { name = "LANGSMITH_PROJECT", value = var.langsmith_project },
      ]
      portMappings = [
        { containerPort = var.container_port, hostPort = var.container_port }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/${var.ecs_task_family}"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "this" {
  name            = var.ecs_service_name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.ecs_service_desired_count
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = [aws_subnet.main.id]
    security_groups  = [aws_security_group.ecs_service_sg.id]
    assign_public_ip = true
  }
}

resource "aws_cloudwatch_log_group" "ecs_logs" {
  name              = "/ecs/${var.ecs_task_family}"
  retention_in_days = 7
}

resource "aws_apigatewayv2_api" "agent_api" {
  name          = var.api_name
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "agent_api_stage" {
  api_id      = aws_apigatewayv2_api.agent_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "agent_api_integration" {
  api_id                 = aws_apigatewayv2_api.agent_api.id
  integration_type       = "HTTP_PROXY"
  integration_method     = "ANY"
  integration_uri        = aws_ecs_service.this.network_configuration[0].assign_public_ip ? "http://${aws_ecs_service.this.name}.ecs.${var.aws_region}.amazonaws.com" : ""
  payload_format_version = "1.0"
}

resource "aws_apigatewayv2_route" "agent_api_route" {
  api_id    = aws_apigatewayv2_api.agent_api.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.agent_api_integration.id}"
}

resource "aws_subnet" "main" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr_block, 8, 0)
  availability_zone       = var.aws_region_az
}

resource "aws_security_group" "ecs_service_sg" {
  name        = "${var.ecs_service_name}-sg"
  description = "Allow inbound HTTP traffic to ECS service on port ${var.container_port}"
  vpc_id      = aws_vpc.main.id

  ingress {
    description      = "Allow HTTP from anywhere (API Gateway)"
    from_port        = var.container_port
    to_port          = var.container_port
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}

