FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files (both package.json + lock file)
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production deps
RUN npm install --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3001
CMD ["node", "dist/index.js"]
