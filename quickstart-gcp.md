# 🚀 Quick Deploy to Google Cloud Platform

## Option 1: Deploy in 5 Minutes (Using Cloud Shell)

### Step 1: Open Cloud Shell
1. Go to https://console.cloud.google.com
2. Click the **>_** terminal icon in the top-right
3. Cloud Shell opens (this is a free Linux terminal in your browser)

### Step 2: Run these commands
Copy and paste these commands in Cloud Shell:

```bash
# 1. Clone the project
git clone https://github.com/yourusername/ankercloud-monitoring.git
cd ankercloud-monitoring

# 2. Set your project ID
export PROJECT_ID=$(gcloud config get-value project)
echo "Using project: $PROJECT_ID"

# 3. Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

# 4. Build using Cloud Build (easier than Docker)
gcloud builds submit --tag gcr.io/$PROJECT_ID/ankercloud-monitoring

# 5. Deploy to Cloud Run
gcloud run deploy ankercloud-monitoring \
  --image gcr.io/$PROJECT_ID/ankercloud-monitoring \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3005 \
  --memory 1Gi

# 6. Get your app URL
gcloud run services describe ankercloud-monitoring \
  --region us-central1 \
  --format 'value(status.url)'
```

Your app will be live at the URL shown! 🎉

---

## Option 2: Deploy Without Git (Copy-Paste Method)

If you don't have the code in a git repository, follow these steps:

### Step 1: Create the App in Cloud Shell

```bash
# 1. Create project directory
mkdir ~/ankercloud-app
cd ~/ankercloud-app

# 2. Create package.json
cat > package.json << 'EOF'
{
  "name": "ankercloud-monitoring",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev -p 3005",
    "build": "next build",
    "start": "next start -p 3005"
  },
  "dependencies": {
    "next": "15.1.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "axios": "^1.6.7",
    "lucide-react": "^0.468.0",
    "tailwindcss": "^3.4.1"
  }
}
EOF

# 3. Create a simple Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3005
CMD ["npm", "start"]
EOF

# 4. Initialize Next.js app
npx create-next-app@latest . --typescript --tailwind --app --no-git
```

### Step 2: Deploy Your App

```bash
# 1. Set project
export PROJECT_ID=$(gcloud config get-value project)

# 2. Build with Cloud Build
gcloud builds submit --tag gcr.io/$PROJECT_ID/ankercloud-app

# 3. Deploy
gcloud run deploy ankercloud-app \
  --image gcr.io/$PROJECT_ID/ankercloud-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3005
```

---

## 🎯 Super Simple: One-Click Deploy

### The Easiest Way - Use Cloud Run Button

1. **Fork the repository** to your GitHub account
2. **Click this button** (add to your README):

```markdown
[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run)
```

3. **Follow the prompts** in your browser
4. **Done!** Your app is deployed

---

## After Deployment

### Access Your Application
1. After deployment, you'll see a URL like:
   ```
   https://ankercloud-monitoring-abc123-uc.a.run.app
   ```
2. Open this URL in your browser
3. You'll see the AnkerCloud Monitoring dashboard!

### Default Login
- **Email**: demo@ankercloud.com
- **Password**: demo123456

### View Logs
```bash
gcloud run logs read --service ankercloud-monitoring --region us-central1
```

### Update Your App
```bash
# Make changes, then:
gcloud builds submit --tag gcr.io/$PROJECT_ID/ankercloud-monitoring
gcloud run deploy ankercloud-monitoring --image gcr.io/$PROJECT_ID/ankercloud-monitoring --region us-central1
```

### Delete Everything (Stop Billing)
```bash
# Delete the Cloud Run service
gcloud run services delete ankercloud-monitoring --region us-central1

# Delete the container image
gcloud container images delete gcr.io/$PROJECT_ID/ankercloud-monitoring
```

---

## 💰 Cost Estimates

### Free Tier Includes:
- **Cloud Run**: 2 million requests/month free
- **Cloud Build**: 120 build-minutes/day free
- **Container Registry**: 0.5 GB storage free

### Estimated Monthly Cost:
- **Small usage** (< 10,000 requests/day): **$0 (Free tier)**
- **Medium usage** (100,000 requests/day): **~$5-10/month**
- **High usage** (1M requests/day): **~$50-100/month**

---

## 🆘 Troubleshooting

### "Permission denied" error
```bash
# Grant Cloud Build permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_ID@cloudbuild.gserviceaccount.com" \
  --role="roles/run.developer"
```

### "APIs not enabled" error
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

### Application not loading
1. Check logs: `gcloud run logs read`
2. Ensure port 3005 is set in Dockerfile
3. Check if allow-unauthenticated is enabled

---

## 📞 Need Help?

1. **Google Cloud Support**: https://cloud.google.com/support
2. **Community Forum**: https://stackoverflow.com/questions/tagged/google-cloud-run
3. **Documentation**: https://cloud.google.com/run/docs
