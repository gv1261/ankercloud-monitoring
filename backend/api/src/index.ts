import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import cors from '@fastify/cors';
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
import incidentsRoutes from './routes/incidents';


// Create Fastify instance
const fastify = Fastify({
  logger: true,
});

// ------------------- Plugins -------------------
async function registerPlugins() {
  await fastify.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });

  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'supersecret',
    sign: {
      expiresIn: '1h',
    },
  });

  await fastify.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.window,
  });

  await fastify.register(websocket);
}

// ------------------- Routes -------------------
async function registerRoutes() {
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(resourceRoutes, { prefix: '/api/resources' });
  await fastify.register(metricsRoutes, { prefix: '/api/metrics' });
  await fastify.register(alertRoutes, { prefix: '/api/alerts' });
  await fastify.register(ingestRoutes, { prefix: '/api/ingest' });
  await fastify.register(incidentsRoutes, { prefix: '/api/incidents' });
  await fastify.register(websocketHandler, { prefix: '/ws' });
}

// ------------------- Authentication decorators -------------------
fastify.decorate(
  'authenticate',
  async (request, reply) => {
    try {
      const user = (await request.jwtVerify()) as any;
      (request as any).user = user;
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  }
);

fastify.decorate(
  'authenticateApiKey',
  async (request, reply) => {
    const apiKeyHeader = request.headers['x-api-key'];
    const apiKey =
      typeof apiKeyHeader === 'string'
        ? apiKeyHeader
        : Array.isArray(apiKeyHeader)
        ? apiKeyHeader[0]
        : null;
    
    console.log('Received API key:', apiKey);

    if (!apiKey) return reply.code(401).send({ error: 'API key required' });

    const isValid = await validateApiKey(apiKey);
    console.log('API key valid?', isValid);

    if (!isValid) return reply.code(401).send({ error: 'Invalid API key' });
  }
);

// ------------------- Health check -------------------
fastify.get('/health', async (_req, reply) => {
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
  return reply.code(health.status === 'healthy' ? 200 : 503).send(health);
});

// ------------------- Metrics -------------------
fastify.get('/metrics', async (_req, reply) => {
  return reply.send({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString(),
  });
});

// ------------------- Placeholder functions -------------------
async function validateApiKey(apiKey: string): Promise<boolean> {
  return true;
}
async function checkDatabaseHealth(): Promise<boolean> {
  return true;
}
async function checkRedisHealth(): Promise<boolean> {
  return true;
}

// ------------------- Start server -------------------
async function start() {
  try {
    await connectDatabase();
    logger.info('Database connected');

    await connectRedis();
    logger.info('Redis connected');

    await registerPlugins();
    await registerRoutes();

    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(
      `AnkerCloud API running on ${config.server.host}:${config.server.port}`
    );
  } catch (err) {
    logger.error('Server start error:', err);
    process.exit(1);
  }
}

// ------------------- Graceful shutdown -------------------
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

start();