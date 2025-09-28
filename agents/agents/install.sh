#!/bin/bash

# AnkerCloud Linux Agent Installation Script
# Usage: curl -sSL https://ankercloud.com/install-agent.sh | bash -s -- --api-key YOUR_API_KEY --resource-id YOUR_RESOURCE_ID

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
INSTALL_DIR="/opt/ankercloud"
CONFIG_DIR="/etc/ankercloud"
SERVICE_NAME="ankercloud-agent"
BINARY_NAME="ankercloud-agent"
API_ENDPOINT="http://localhost:3001/api/ingest/server"
INTERVAL=30

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --api-key)
            API_KEY="$2"
            shift 2
            ;;
        --resource-id)
            RESOURCE_ID="$2"
            shift 2
            ;;
        --api-endpoint)
            API_ENDPOINT="$2"
            shift 2
            ;;
        --interval)
            INTERVAL="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

# Validate required parameters
if [ -z "$API_KEY" ] || [ -z "$RESOURCE_ID" ]; then
    echo -e "${RED}Error: --api-key and --resource-id are required${NC}"
    echo "Usage: $0 --api-key YOUR_API_KEY --resource-id YOUR_RESOURCE_ID [--api-endpoint URL] [--interval SECONDS]"
    exit 1
fi

echo -e "${GREEN}=== AnkerCloud Linux Agent Installation ===${NC}"
echo "API Endpoint: $API_ENDPOINT"
echo "Resource ID: $RESOURCE_ID"
echo "Collection Interval: ${INTERVAL}s"

# Create directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p $INSTALL_DIR
mkdir -p $CONFIG_DIR

# Download the agent binary (in production, this would download from your server)
echo -e "${YELLOW}Building agent binary...${NC}"
AGENT_DIR="$(dirname "$0")"
cd "$AGENT_DIR"

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo -e "${YELLOW}Go is not installed. Installing Go...${NC}"
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    rm go1.21.5.linux-amd64.tar.gz
fi

# Build the agent
go build -o $BINARY_NAME main.go
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to build agent${NC}"
    exit 1
fi

# Copy binary to installation directory
cp $BINARY_NAME $INSTALL_DIR/
chmod +x $INSTALL_DIR/$BINARY_NAME

# Create configuration file
echo -e "${YELLOW}Creating configuration...${NC}"
cat > $CONFIG_DIR/agent.yaml <<EOF
# AnkerCloud Agent Configuration
api_endpoint: $API_ENDPOINT
api_key: $API_KEY
resource_id: $RESOURCE_ID
interval: $INTERVAL
hostname: $(hostname)
EOF

chmod 600 $CONFIG_DIR/agent.yaml

# Create systemd service file
echo -e "${YELLOW}Creating systemd service...${NC}"
cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=AnkerCloud Monitoring Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=$INSTALL_DIR/$BINARY_NAME -config $CONFIG_DIR/agent.yaml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start service
echo -e "${YELLOW}Starting service...${NC}"
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

# Check service status
sleep 2
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✓ AnkerCloud Agent installed and running successfully!${NC}"
    echo ""
    echo "Commands:"
    echo "  View status:  systemctl status $SERVICE_NAME"
    echo "  View logs:    journalctl -u $SERVICE_NAME -f"
    echo "  Stop agent:   systemctl stop $SERVICE_NAME"
    echo "  Start agent:  systemctl start $SERVICE_NAME"
    echo "  Restart:      systemctl restart $SERVICE_NAME"
    echo ""
    echo "Configuration: $CONFIG_DIR/agent.yaml"
else
    echo -e "${RED}✗ Failed to start agent. Check logs: journalctl -u $SERVICE_NAME${NC}"
    exit 1
fi
