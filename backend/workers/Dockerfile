FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools required for node-gyp
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .

FROM node:20-alpine
WORKDIR /app

# Install runtime dependencies needed for compiled modules
RUN apk add --no-cache python3

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/src ./src

CMD ["npm", "start"]