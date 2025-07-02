variable "aws_region" {
  type = string
  default = "ap-southeast-2"
}
variable aws_region_az_1 {
  type = string
  default = "ap-southeast-2a"
}
variable "aws_region_az_2" {
  type = string
  default = "ap-southeast-2b"
}

variable "vpc_name" { type = string }
variable "api_name" { type = string }
variable "ecr_repo_name" { type = string }
variable "ecs_cluster_name" { type = string }
variable "ecs_service_name" { type = string }
variable "ecs_task_family" { type = string }
variable "ecs_task_name" { type = string }
variable "ecs_task_cpu" {
  type = string
  default = "512"
}
variable "ecs_task_memory" {
  type = string
  default = "1024"
}
variable "ecs_service_desired_count" {
  type = number
  default = 1
}

variable "bedrock_region" {
  type = string
  default = "ap-southeast-2"
}
variable "bedrock_model_id" { type = string }
variable "bedrock_access_key" { type = string }
variable "bedrock_secret_key" { type = string }

variable "ollama_host" { type = string }
variable "ollama_model" { type = string }
variable "evaluator_model" { type = string }
variable "google_api_key" { type = string }
variable "google_model" { type = string }
variable "langsmith_api_key" { type = string }
variable "langsmith_project" { type = string }
variable "langsmith_tracing" { type = string }
variable "langsmith_endpoint" { type = string }

variable "container_port" {
  type    = number
  default = 3000
}

variable "vpc_cidr_block" {
  type    = string
  default = "10.0.0.0/16"
}
