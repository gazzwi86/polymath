# Polymath

A TypeScript LangChain agent for generating Tech Radar meeting invite blurbs, supporting both local (Ollama) and remote (Gemini) LLMs, with observability via LangSmith. Built for cloud-native, serverless deployment on AWS Fargate using Docker and Terraform, and automated CI/CD with GitHub Actions.

## Features

- TypeScript, LangChain agent
- Supports Ollama (local) and Gemini (Google) LLMs
- Environment variable-based configuration for all secrets and endpoints
- Observability with LangSmith
- Linting (ESLint), testing (Jest), and formatting (.editorconfig)
- Infrastructure-as-Code with Terraform (infra/)
- Automated CI/CD and deployment to AWS Fargate via GitHub Actions

## How It Works

- The agent receives a user prompt and generates a meeting invite blurb using the configured LLM (prefers Gemini if API key is set, otherwise Ollama)
- All API keys and endpoints are provided via environment variables
- The app is stateless and designed for ephemeral, serverless execution (ECS Fargate)
- Observability hooks (LangSmith) are included for tracing and evaluation

## Local Development

1. Copy `.env.example` to `.env` and fill in your keys:
   - `OLLAMA_HOST`, `OLLAMA_MODEL`, `GOOGLE_API_KEY`, `EVALUATOR_MODEL`, etc.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Run tests:
   ```sh
   npm test
   ```
4. Lint code:
   ```sh
   npx eslint .
   ```
5. Run the agent locally:
   ```sh
   npx ts-node src/index.ts "<your prompt here>"
   ```

## Cloud Deployment (AWS Fargate)

### Prerequisites

- AWS account with permissions for ECS, ECR, IAM, CloudWatch, VPC
- Terraform installed
- Docker installed
- All required secrets set in GitHub repository (see below)

### Infrastructure Setup

1. Edit `infra/variables.tf` and/or create a `terraform.tfvars` file with your values (VPC, subnets, roles, etc.)
2. Build and push Docker image to ECR (automated by GitHub Actions, or manually):
   ```sh
   docker build -t <your_ecr_repo>:latest .
   docker push <your_ecr_repo>:latest
   ```
3. Deploy infrastructure:
   ```sh
   cd infra
   terraform init
   terraform apply -auto-approve
   ```

### CI/CD Pipeline

- On every push to `main`, GitHub Actions will:
  - Build and test the app
  - Build and push a Docker image to ECR
  - Run `terraform apply` to update ECS Fargate service
- All secrets and config are passed as environment variables from GitHub Secrets

#### Required GitHub Secrets

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- `ECR_REPO_NAME`, `ECS_CLUSTER_NAME`, `ECS_TASK_FAMILY`, `ECS_TASK_CPU`, `ECS_TASK_MEMORY`, `ECS_TASK_EXECUTION_ROLE_ARN`, `ECS_TASK_ROLE_ARN`, `ECS_SERVICE_NAME`, `ECS_SERVICE_DESIRED_COUNT`
- `SUBNET_IDS`, `SECURITY_GROUP_IDS`
- `OLLAMA_HOST`, `OLLAMA_MODEL`, `GOOGLE_API_KEY`, `EVALUATOR_MODEL`

##### Optional secrets

- `ECR_REPO_NAME`, `ECS_CLUSTER_NAME`, `ECS_TASK_FAMILY`, `ECS_TASK_CPU`, `ECS_TASK_MEMORY`, `ECS_TASK_EXECUTION_ROLE_ARN`, `ECS_TASK_ROLE_ARN`, `ECS_SERVICE_NAME`, `ECS_SERVICE_DESIRED_COUNT`

## Observability

- Integrates with LangSmith for tracing and evaluation

## Notes

- The app is stateless and ephemeral by design (ideal for serverless/task-based workloads)
- For persistent APIs, expose a port and update the ECS task/service accordingly
- All configuration is via environment variables for security and flexibility

## License

MIT
