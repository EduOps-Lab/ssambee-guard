# ![ssambee-guard Logo](https://via.placeholder.com/150?text=ssambee-guard)

# ssambee-guard

> **Cost-effective and efficient server monitoring and alert system tailored for your environment.**

`ssambee-guard` is an open-source monitoring solution designed to monitor server logs, biometrics, and system metrics 24/7 with minimal costs. Leveraging AWS Lambda and Turso (LibSQL), it is engineered to run at a cost of less than $0.1 per month.

---

## 🌟 Why ssambee-guard?

- **Ultra-Low Cost**: Minimizes operational expenses by maximizing the Free Tier of AWS Lambda and Turso DB.
- **Real-time Monitoring**: Real-time server logs and status can be viewed on the dashboard via Server-Sent Events (SSE).
- **Diverse Alerts**: Immediate propagation of failure situations through Discord webhooks and Kakao Notification Talk (Solapi) integration.
- **Efficient Log Analysis**: Quickly find necessary information among numerous logs with server-side pagination and filtering features.

---

## 🚀 Getting Started

### 1. Minimal Setup (Docker)

The fastest way to check the project locally is using Docker.

```bash
# Clone the repository
git clone https://github.com/your-repo/ssambee-guard.git
cd ssambee-guard

# Set up environment variables (Minimal setup)
cp frontend/.env.example frontend/.env.local

# Run Docker
docker-compose up --build
```
Now you can access the dashboard UI at `http://localhost:3000`.

### 2. Hello World (Log Ingest Test)

To record your first log on the dashboard, run the following `curl` command:

```bash
curl -X POST https://<your-lambda-url>/ingest \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: <your-internal-secret>" \
  -d '{
    "logs": [
      {
        "level": "INFO",
        "message": "Hello World! ssambee-guard is running normally.",
        "metadata": { "source": "curl-test" }
      }
    ]
  }'
```
If successful, you will immediately see the message in the real-time log feed on the dashboard.

---

## ⚙️ Configuration

To operate this project in production, the following external service configurations are required:

1.  **Turso DB**: Database to store server metrics and logs. (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`)
2.  **Discord Webhook**: Channel URL to receive error and resource alerts. (`DISCORD_WEBHOOK_URL`)
3.  **Solapi (Optional)**: API Key/Secret for sending Kakao Notification Talk. (Store in AWS SSM Parameter Store)
4.  **Shared Secret**: Key for securing the Ingest API. (`INTERNAL_INGEST_SECRET`)

For detailed DB setup instructions, please refer to `functions/monitoring-dashboard/TURSO_SETUP.md`.

---

## 🛠 Developing

Steps to set up the local development environment:

```bash
# 1. Install dependencies
pnpm install

# 2. Run frontend development server
cd frontend
pnpm run dev

# 3. Test Lambda functions
pnpm test
```

### Directory Structure
- `frontend/`: Management dashboard based on Next.js 15 (React 19)
- `functions/`: Source code for AWS Lambda
  - `central-monitor`: Handles system metrics and Discord alerts
  - `kakao-notification`: Sends notification talks via SQS trigger
  - `monitoring-dashboard`: Dashboard API and SSE streaming
  - `log-cleanup`: Automatic deletion of old logs (Batch)
- `terraform/`: AWS infrastructure as code

---

## 🏗 Building & Deploying

### Building (Bundling)
Bundle the TypeScript code for uploading to AWS Lambda:

```bash
pnpm run build
```
This command uses `esbuild` to generate `functions/*/dist/index.js`.

### Deploying
Deploy the AWS infrastructure using Terraform:

```bash
cd terraform
terraform init
terraform plan
terraform apply
```
Once deployment is complete, the generated API Gateway URL and Lambda Function URL will be output.

---

## ✨ Features

- **Real-time Streaming Dashboard**: Visualizes real-time logs and metrics via SSE.
- **Log Search & Filtering**: Precise log inquiry by level and period.
- **Alert History Management**: Store and view detailed contents of all occurred alerts.
- **Automatic Log Cleanup**: Automatically deletes logs older than 14 days to optimize Turso DB capacity.
- **User Management**: Admin approval-based registration and role management system.

---

## 🤝 Contributing

Thank you for your interest in `ssambee-guard`! Contributions are always welcome.

- If you find a bug or have a suggestion, please create an **Issue**.
- To contribute code, please **Fork** the repository and send a **Pull Request** from a **Feature Branch**.
- We recommend starting with issues labeled **Good First Issue**.

"Your small contribution can save someone's monthly server costs."

---

## 🔗 Links

- **Issue Tracker**: [GitHub Issues](https://github.com/your-repo/ssambee-guard/issues)
- **Related Projects**:
  - [Solapi SDK](https://github.com/solapi/solapi-nodejs)
  - [Turso (LibSQL)](https://turso.tech)

---

## 📜 Licensing

This project is licensed under the **ISC License**. For more details, please refer to the `license` field in `package.json`.
