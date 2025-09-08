import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase } from './database/connection';
import { connectRedis } from './utils/redis';

// Import routes
import authRoutes from './routes/auth';
import resourceRoutes from './routes/resources';
import metricsRoutes from './routes/metrics';
import alertRoutes from './routes/alerts';
import ingestRoutes from './routes/ingest';
import websocketHandler from './routes/websocket';

// Create Fastify instance
const fastify = Fastify({
  logger: logger,
  trustProxy: true,
});

// Register plugins
async function registerPlugins() {
  // CORS
  await fastify.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });

  // JWT
  await fastify.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.window,
  });

  // WebSocket support
  await fastify.register(websocket);
}

// Register routes
async function registerRoutes() {
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(resourceRoutes, { prefix: '/api/resources' });
  await fastify.register(metricsRoutes, { prefix: '/api/metrics' });
  await fastify.register(alertRoutes, { prefix: '/api/alerts' });
  await fastify.register(ingestRoutes, { prefix: '/api/ingest' });
  await fastify.register(websocketHandler, { prefix: '/ws' });
}

// Authentication decorator
fastify.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// API key authentication decorator
fastify.decorate('authenticateApiKey', async function (request: any, reply: any) {
  const apiKey = request.headers['x-api-key'];

  if (!apiKey) {
    return reply.code(401).send({ error: 'API key required' });
  }

  // Validate API key from database
  const isValid = await validateApiKey(apiKey);
  if (!isValid) {
    return reply.code(401).send({ error: 'Invalid API key' });
  }
});

// Health check route
fastify.get('/health', async (request, reply) => {
  const dbHealth = await checkDatabaseHealth();
  const redisHealth = await checkRedisHealth();

  const health = {
    status: dbHealth && redisHealth ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth ? 'connected' : 'disconnected',
      redis: redisHealth ? 'connected' : 'disconnected',
    },
    version: process.env.npm_package_version || '1.0.0',
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;
  return reply.code(statusCode).send(health);
});

// Metrics endpoint for self-monitoring
fastify.get('/metrics', async (request, reply) => {
  const metrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString(),
  };

  return reply.send(metrics);
});

// Placeholder functions (to be implemented)
async function validateApiKey(apiKey: string): Promise<boolean> {
  // TODO: Implement API key validation from database
  return true;
}

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    // TODO: Implement database health check
    return true;
  } catch {
    return false;
  }
}

async function checkRedisHealth(): Promise<boolean> {
  try {
    // TODO: Implement Redis health check
    return true;
  } catch {
    return false;
  }
}

// Start server
async function start() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');

    // Register plugins and routes
    await registerPlugins();
    await registerRoutes();

    // Start server
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(`AnkerCloud Monitoring API server running on ${config.server.host}:${config.server.port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await fastify.close();
  process.exit(0);
});

// Start the server
start();
