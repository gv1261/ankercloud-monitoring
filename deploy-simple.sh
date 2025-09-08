#!/bin/bash

# Simple Deployment Script for AnkerCloud Monitoring
# This script deploys the monitoring platform to Google Cloud Platform

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  AnkerCloud Monitoring - GCP Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
echo -e "${YELLOW}Step 1: Setting up your GCP project${NC}"
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "Please enter your GCP Project ID:"
    read PROJECT_ID
    gcloud config set project $PROJECT_ID
fi
echo "Using project: $PROJECT_ID"

# Set region
REGION="us-central1"
echo "Using region: $REGION"

# Enable APIs
echo ""
echo -e "${YELLOW}Step 2: Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    sqladmin.googleapis.com

echo -e "${GREEN}✓ APIs enabled${NC}"

# Create Artifact Registry repository
echo ""
echo -e "${YELLOW}Step 3: Creating container repository...${NC}"
gcloud artifacts repositories create ankercloud-repo \
    --repository-format=docker \
    --location=$REGION \
    --description="AnkerCloud Monitoring Docker repository" \
    2>/dev/null || echo "Repository already exists"

# Configure Docker
gcloud auth configure-docker ${REGION}-docker.pkg.dev

echo -e "${GREEN}✓ Container repository ready${NC}"

# Build and push the frontend image
echo ""
echo -e "${YELLOW}Step 4: Building the application...${NC}"
echo "This will take a few minutes..."

# Create a simple Dockerfile if it doesn't exist
if [ ! -f "Dockerfile.simple" ]; then
cat > Dockerfile.simple << 'EOF'
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lockb* ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Build the application
RUN npm run build

EXPOSE 3005

CMD ["npm", "start"]
EOF
fi

# Build the Docker image
docker build -f Dockerfile.simple -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/ankercloud-repo/monitoring:latest .

# Push to Artifact Registry
echo "Pushing image to Google Cloud..."
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/ankercloud-repo/monitoring:latest

echo -e "${GREEN}✓ Application built and pushed${NC}"

# Deploy to Cloud Run
echo ""
echo -e "${YELLOW}Step 5: Deploying to Cloud Run...${NC}"
gcloud run deploy ankercloud-monitoring \
    --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/ankercloud-repo/monitoring:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 3005 \
    --memory 1Gi \
    --cpu 1 \
    --max-instances 10 \
    --set-env-vars "NODE_ENV=production"

# Get the service URL
SERVICE_URL=$(gcloud run services describe ankercloud-monitoring --region=$REGION --format='value(status.url)')

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}Your application is live at:${NC}"
echo -e "${YELLOW}$SERVICE_URL${NC}"
echo ""
echo -e "${GREEN}What to do next:${NC}"
echo "1. Open the URL above in your browser"
echo "2. Click 'Use Demo Credentials' to login"
echo "3. Explore the monitoring dashboard"
echo ""
echo -e "${YELLOW}To update the deployment later, run:${NC}"
echo "  ./deploy-simple.sh"
echo ""
echo -e "${YELLOW}To delete everything and avoid charges:${NC}"
echo "  gcloud run services delete ankercloud-monitoring --region=$REGION"
echo ""
