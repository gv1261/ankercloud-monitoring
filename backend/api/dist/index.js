"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const connection_1 = require("./database/connection");
const redis_1 = require("./utils/redis");
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const resources_1 = __importDefault(require("./routes/resources"));
const metrics_1 = __importDefault(require("./routes/metrics"));
const alerts_1 = __importDefault(require("./routes/alerts"));
const ingest_1 = __importDefault(require("./routes/ingest"));
const websocket_2 = __importDefault(require("./routes/websocket"));
// Create Fastify instance
const fastify = (0, fastify_1.default)({
    logger: true,
});
// ------------------- Plugins -------------------
async function registerPlugins() {
    await fastify.register(cors_1.default, {
        origin: config_1.config.cors.origin,
        credentials: true,
    });
    await fastify.register(jwt_1.default, {
        secret: process.env.JWT_SECRET || 'supersecret',
        sign: {
            expiresIn: '1h',
        },
    });
    await fastify.register(rate_limit_1.default, {
        max: config_1.config.rateLimit.max,
        timeWindow: config_1.config.rateLimit.window,
    });
    await fastify.register(websocket_1.default);
}
// ------------------- Routes -------------------
async function registerRoutes() {
    await fastify.register(auth_1.default, { prefix: '/api/auth' });
    await fastify.register(resources_1.default, { prefix: '/api/resources' });
    await fastify.register(metrics_1.default, { prefix: '/api/metrics' });
    await fastify.register(alerts_1.default, { prefix: '/api/alerts' });
    await fastify.register(ingest_1.default, { prefix: '/api/ingest' });
    await fastify.register(websocket_2.default, { prefix: '/ws' });
}
// ------------------- Authentication decorators -------------------
fastify.decorate('authenticate', async (request, reply) => {
    try {
        const user = (await request.jwtVerify());
        request.user = user;
    }
    catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
    }
});
fastify.decorate('authenticateApiKey', async (request, reply) => {
    const apiKeyHeader = request.headers['x-api-key'];
    const apiKey = typeof apiKeyHeader === 'string'
        ? apiKeyHeader
        : Array.isArray(apiKeyHeader)
            ? apiKeyHeader[0]
            : null;
    if (!apiKey)
        return reply.code(401).send({ error: 'API key required' });
    const isValid = await validateApiKey(apiKey);
    if (!isValid)
        return reply.code(401).send({ error: 'Invalid API key' });
});
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
async function validateApiKey(_apiKey) {
    return true;
}
async function checkDatabaseHealth() {
    return true;
}
async function checkRedisHealth() {
    return true;
}
// ------------------- Start server -------------------
async function start() {
    try {
        await (0, connection_1.connectDatabase)();
        logger_1.logger.info('Database connected');
        await (0, redis_1.connectRedis)();
        logger_1.logger.info('Redis connected');
        await registerPlugins();
        await registerRoutes();
        await fastify.listen({
            port: config_1.config.server.port,
            host: config_1.config.server.host,
        });
        logger_1.logger.info(`🚀 AnkerCloud API running on ${config_1.config.server.host}:${config_1.config.server.port}`);
    }
    catch (err) {
        logger_1.logger.error('Server start error:', err);
        process.exit(1);
    }
}
// ------------------- Graceful shutdown -------------------
process.on('SIGTERM', async () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully');
    await fastify.close();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger_1.logger.info('SIGINT received, shutting down gracefully');
    await fastify.close();
    process.exit(0);
});
start();
//# sourceMappingURL=index.js.map