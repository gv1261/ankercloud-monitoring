# AnkerCloud Monitoring Platform

A comprehensive enterprise-grade monitoring solution for servers, websites, networks, and databases.

## Features

- **Server Monitoring**: CPU, memory, disk, network, processes monitoring via installable agents
- **Website Monitoring**: HTTP/HTTPS uptime, response time, SSL certificate checks
- **Network Monitoring**: Ping, port availability, traceroute, latency tracking
- **Database Monitoring**: Connection pools, query performance, replication status
- **Real-time Dashboard**: Live metrics, charts, and status updates via WebSocket
- **Alert System**: Configurable thresholds with email, webhook, and SMS notifications
- **Multi-platform Agents**: Linux and Windows monitoring agents

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Fastify, TypeScript
- **Database**: PostgreSQL with TimescaleDB for time-series data
- **Cache/Queue**: Redis, Bull queues
- **Monitoring Agents**: Go (for performance)
- **Real-time**: WebSockets
- **Deployment**: Docker, Google Cloud Platform

## Quick Start

### Prerequisites

- Node.js 20+ or Bun
- PostgreSQL 14+ with TimescaleDB extension
- Redis 6+
- Docker (optional)

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/ankercloud-monitoring.git
cd ankercloud-monitoring
```

2. **Install dependencies**
```bash
# Frontend
bun install

# Backend API
cd backend/api && bun install
cd ../scheduler && npm install
cd ../workers && npm install
```

3. **Set up the database**
```bash
# Create database
createdb ankercloud_monitoring

# Run schema
psql -d ankercloud_monitoring -f database/schema.sql
```

4. **Configure environment variables**
```bash
# Frontend
cp .env.example .env.local

# Backend API
cd backend/api
cp .env.example .env
```

5. **Start the services**
```bash
# Start all services with Docker Compose
docker-compose up

# Or start individually:
# Terminal 1 - Frontend
bun run dev

# Terminal 2 - API
cd backend/api && bun run dev

# Terminal 3 - Scheduler
cd backend/scheduler && npm run dev

# Terminal 4 - Workers
cd backend/workers && npm run dev
```

6. **Access the dashboard**
Open http://localhost:3005 in your browser

### Default Credentials (Demo)
- Email: demo@ankercloud.com
- Password: demo123456

## Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build
```

### Google Cloud Platform (GCP) Deployment

1. **Prerequisites**
   - GCP account with billing enabled
   - gcloud CLI installed and configured
   - Docker installed

2. **Set your project ID**
```bash
export GCP_PROJECT_ID="your-project-id"
gcloud config set project $GCP_PROJECT_ID
```

3. **Run the deployment script**
```bash
chmod +x deploy-gcp.sh
./deploy-gcp.sh
```

4. **Manual deployment steps**
```bash
# Enable APIs
gcloud services enable run.googleapis.com sqladmin.googleapis.com redis.googleapis.com

# Create Cloud SQL instance
gcloud sql instances create ankercloud-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1

# Build and push images
docker build -t gcr.io/$GCP_PROJECT_ID/ankercloud-frontend .
docker push gcr.io/$GCP_PROJECT_ID/ankercloud-frontend

# Deploy to Cloud Run
gcloud run deploy ankercloud-frontend \
  --image gcr.io/$GCP_PROJECT_ID/ankercloud-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3005
```

## Installing Monitoring Agents

### Linux Agent

```bash
# Quick install
curl -sSL https://your-domain.com/install-agent.sh | sudo bash -s -- \
  --api-key YOUR_API_KEY \
  --resource-id YOUR_RESOURCE_ID

# Manual install
cd agents/linux
go build -o ankercloud-agent main.go
sudo ./install.sh --api-key YOUR_API_KEY --resource-id YOUR_RESOURCE_ID
```

### Windows Agent

```powershell
# Download and run installer
Invoke-WebRequest -Uri https://your-domain.com/ankercloud-agent.msi -OutFile ankercloud-agent.msi
msiexec /i ankercloud-agent.msi API_KEY=YOUR_API_KEY RESOURCE_ID=YOUR_RESOURCE_ID
```

## API Documentation

### Authentication

```javascript
// Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

// Response
{
  "user": { ... },
  "token": "jwt-token"
}
```

### Resources

```javascript
// Get all resources
GET /api/resources
Authorization: Bearer <token>

// Create server resource
POST /api/resources/servers
{
  "name": "production-server",
  "hostname": "server.example.com",
  "ipAddress": "192.168.1.100"
}
```

### Metrics Ingestion

```javascript
// Send server metrics
POST /api/ingest/server
X-API-Key: <api-key>
{
  "resourceId": "uuid",
  "metrics": {
    "cpuUsagePercent": 45.2,
    "memoryUsedMb": 4096,
    ...
  }
}
```

## Project Structure

```
ankercloud-monitoring/
├── src/                    # Frontend (Next.js)
│   ├── app/               # App pages
│   ├── components/        # React components
│   ├── contexts/          # React contexts
│   └── lib/               # Utilities
├── backend/
│   ├── api/               # REST API server
│   ├── scheduler/         # Job scheduler
│   ├── workers/           # Monitoring workers
│   └── alerter/           # Alert engine
├── agents/
│   ├── linux/             # Linux monitoring agent
│   └── windows/           # Windows monitoring agent
├── database/
│   └── schema.sql         # Database schema
└── docker-compose.yml     # Docker configuration
```

## Development Status

- ✅ Dashboard UI (100%)
- ✅ Backend API (90%)
- ✅ Database Schema (100%)
- ✅ Linux Agent (100%)
- ✅ Authentication System (100%)
- ⚠️ Workers & Schedulers (70%)
- ⚠️ Alert Engine (60%)
- ❌ Windows Agent (0%)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@ankercloud.com or open an issue in the repository.

## Roadmap

- [ ] Multi-tenant support
- [ ] Mobile application
- [ ] Kubernetes monitoring
- [ ] APM (Application Performance Monitoring)
- [ ] Log aggregation
- [ ] Synthetic monitoring from multiple regions
- [ ] Machine learning for anomaly detection
- [ ] Terraform provider
