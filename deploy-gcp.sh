#!/bin/bash

# AnkerCloud Monitoring - GCP Deployment Script
# This script deploys the entire monitoring platform to Google Cloud Platform

set -e

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"your-gcp-project-id"}
REGION=${GCP_REGION:-"us-central1"}
ZONE=${GCP_ZONE:-"us-central1-a"}
DB_INSTANCE_NAME="ankercloud-db"
REDIS_INSTANCE_NAME="ankercloud-redis"
SERVICE_NAME="ankercloud-monitoring"
FRONTEND_SERVICE="ankercloud-frontend"
API_SERVICE="ankercloud-api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== AnkerCloud Monitoring GCP Deployment ===${NC}"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}gcloud CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Set the project
echo -e "${YELLOW}Setting GCP project...${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}Enabling required GCP APIs...${NC}"
gcloud services enable \
    compute.googleapis.com \
    container.googleapis.com \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    secretmanager.googleapis.com

# Create Cloud SQL instance with PostgreSQL
echo -e "${YELLOW}Creating Cloud SQL instance...${NC}"
gcloud sql instances create $DB_INSTANCE_NAME \
    --database-version=POSTGRES_14 \
    --tier=db-g1-small \
    --region=$REGION \
    --network=default \
    --no-backup \
    --database-flags=shared_preload_libraries=timescaledb \
    || echo "Database instance may already exist"

# Create database
echo -e "${YELLOW}Creating database...${NC}"
gcloud sql databases create ankercloud_monitoring \
    --instance=$DB_INSTANCE_NAME \
    || echo "Database may already exist"

# Create database user
echo -e "${YELLOW}Creating database user...${NC}"
gcloud sql users create ankercloud \
    --instance=$DB_INSTANCE_NAME \
    --password=ankercloud_secret_change_this

# Get database connection name
DB_CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE_NAME --format="value(connectionName)")

# Create Memorystore Redis instance
echo -e "${YELLOW}Creating Redis instance...${NC}"
gcloud redis instances create $REDIS_INSTANCE_NAME \
    --size=1 \
    --region=$REGION \
    --redis-version=redis_6_x \
    || echo "Redis instance may already exist"

# Get Redis host
REDIS_HOST=$(gcloud redis instances describe $REDIS_INSTANCE_NAME --region=$REGION --format="value(host)")

# Build and push Docker images to Container Registry
echo -e "${YELLOW}Building and pushing Docker images...${NC}"

# Build frontend
echo "Building frontend..."
docker build -t gcr.io/$PROJECT_ID/ankercloud-frontend:latest .
docker push gcr.io/$PROJECT_ID/ankercloud-frontend:latest

# Build API
echo "Building API..."
docker build -t gcr.io/$PROJECT_ID/ankercloud-api:latest ./backend/api
docker push gcr.io/$PROJECT_ID/ankercloud-api:latest

# Build Scheduler
echo "Building Scheduler..."
docker build -t gcr.io/$PROJECT_ID/ankercloud-scheduler:latest ./backend/scheduler
docker push gcr.io/$PROJECT_ID/ankercloud-scheduler:latest

# Build Workers
echo "Building Workers..."
docker build -t gcr.io/$PROJECT_ID/ankercloud-workers:latest ./backend/workers
docker push gcr.io/$PROJECT_ID/ankercloud-workers:latest

# Deploy API to Cloud Run
echo -e "${YELLOW}Deploying API service...${NC}"
gcloud run deploy $API_SERVICE \
    --image gcr.io/$PROJECT_ID/ankercloud-api:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 3001 \
    --set-env-vars "DATABASE_URL=postgresql://ankercloud:ankercloud_secret_change_this@/$DB_INSTANCE_NAME?host=/cloudsql/$DB_CONNECTION_NAME" \
    --set-env-vars "REDIS_URL=redis://$REDIS_HOST:6379" \
    --set-env-vars "JWT_SECRET=your-super-secret-jwt-key-$(openssl rand -hex 32)" \
    --set-env-vars "NODE_ENV=production" \
    --add-cloudsql-instances $DB_CONNECTION_NAME \
    --memory 512Mi \
    --cpu 1

# Get API URL
API_URL=$(gcloud run services describe $API_SERVICE --region=$REGION --format="value(status.url)")

# Deploy Frontend to Cloud Run
echo -e "${YELLOW}Deploying frontend service...${NC}"
gcloud run deploy $FRONTEND_SERVICE \
    --image gcr.io/$PROJECT_ID/ankercloud-frontend:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 3005 \
    --set-env-vars "NEXT_PUBLIC_API_URL=$API_URL/api" \
    --memory 512Mi \
    --cpu 1

# Deploy Scheduler as a Cloud Run Job
echo -e "${YELLOW}Deploying scheduler job...${NC}"
gcloud run jobs create ankercloud-scheduler \
    --image gcr.io/$PROJECT_ID/ankercloud-scheduler:latest \
    --region $REGION \
    --set-env-vars "DATABASE_URL=postgresql://ankercloud:ankercloud_secret_change_this@/$DB_INSTANCE_NAME?host=/cloudsql/$DB_CONNECTION_NAME" \
    --set-env-vars "REDIS_URL=redis://$REDIS_HOST:6379" \
    --set-env-vars "NODE_ENV=production" \
    --set-cloudsql-instances $DB_CONNECTION_NAME \
    --memory 512Mi \
    --cpu 1 \
    || echo "Scheduler job may already exist"

# Deploy Workers as a Cloud Run service
echo -e "${YELLOW}Deploying workers service...${NC}"
gcloud run deploy ankercloud-workers \
    --image gcr.io/$PROJECT_ID/ankercloud-workers:latest \
    --platform managed \
    --region $REGION \
    --no-allow-unauthenticated \
    --port 8080 \
    --set-env-vars "DATABASE_URL=postgresql://ankercloud:ankercloud_secret_change_this@/$DB_INSTANCE_NAME?host=/cloudsql/$DB_CONNECTION_NAME" \
    --set-env-vars "REDIS_URL=redis://$REDIS_HOST:6379" \
    --set-env-vars "API_ENDPOINT=$API_URL/api/ingest" \
    --set-env-vars "NODE_ENV=production" \
    --add-cloudsql-instances $DB_CONNECTION_NAME \
    --memory 512Mi \
    --cpu 1

# Get Frontend URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region=$REGION --format="value(status.url)")

# Initialize database schema
echo -e "${YELLOW}Initializing database schema...${NC}"
gcloud sql import sql $DB_INSTANCE_NAME gs://your-bucket/schema.sql \
    || echo "You need to upload schema.sql to a GCS bucket and update this command"

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Frontend URL: $FRONTEND_URL"
echo "API URL: $API_URL"
echo ""
echo "Next steps:"
echo "1. Update the database password (currently using default)"
echo "2. Configure custom domain if needed"
echo "3. Set up monitoring and alerting"
echo "4. Upload database schema: gsutil cp database/schema.sql gs://your-bucket/"
echo "5. Run database initialization"
echo ""
echo "To view logs:"
echo "  gcloud run logs read --service=$FRONTEND_SERVICE --region=$REGION"
echo "  gcloud run logs read --service=$API_SERVICE --region=$REGION"
