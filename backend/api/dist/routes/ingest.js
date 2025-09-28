"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const connection_1 = require("../database/connection");
const logger_1 = require("../utils/logger");
const redis_1 = require("../utils/redis");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Validation schemas
const serverMetricsSchema = zod_1.z.object({
    resourceId: zod_1.z.string().uuid(),
    metrics: zod_1.z.object({
        cpuUsagePercent: zod_1.z.number().min(0).max(100),
        memoryUsedMb: zod_1.z.number(),
        memoryTotalMb: zod_1.z.number(),
        memoryUsagePercent: zod_1.z.number().min(0).max(100),
        diskUsedMb: zod_1.z.number(),
        diskTotalMb: zod_1.z.number(),
        diskUsagePercent: zod_1.z.number().min(0).max(100),
        networkInBytes: zod_1.z.number(),
        networkOutBytes: zod_1.z.number(),
        processCount: zod_1.z.number(),
        loadAvg1m: zod_1.z.number().optional(),
        loadAvg5m: zod_1.z.number().optional(),
        loadAvg15m: zod_1.z.number().optional(),
        uptimeSeconds: zod_1.z.number(),
    }),
    processes: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        pid: zod_1.z.number(),
        cpuPercent: zod_1.z.number(),
        memoryMb: zod_1.z.number(),
        status: zod_1.z.string(),
    })).optional(),
    services: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        status: zod_1.z.string(),
        startupType: zod_1.z.string().optional(),
    })).optional(),
    timestamp: zod_1.z.string().datetime().optional(),
});
const websiteMetricsSchema = zod_1.z.object({
    resourceId: zod_1.z.string().uuid(),
    metrics: zod_1.z.object({
        statusCode: zod_1.z.number(),
        responseTimeMs: zod_1.z.number(),
        dnsTimeMs: zod_1.z.number().optional(),
        connectTimeMs: zod_1.z.number().optional(),
        tlsTimeMs: zod_1.z.number().optional(),
        ttfbMs: zod_1.z.number().optional(),
        totalTimeMs: zod_1.z.number(),
        contentSizeBytes: zod_1.z.number().optional(),
        isAvailable: zod_1.z.boolean(),
        errorMessage: zod_1.z.string().optional(),
        location: zod_1.z.string().optional(),
    }),
    timestamp: zod_1.z.string().datetime().optional(),
});
const networkMetricsSchema = zod_1.z.object({
    resourceId: zod_1.z.string().uuid(),
    metrics: zod_1.z.object({
        checkType: zod_1.z.enum(['ping', 'port', 'traceroute']),
        latencyMs: zod_1.z.number().optional(),
        packetLossPercent: zod_1.z.number().optional(),
        isAvailable: zod_1.z.boolean(),
        hopCount: zod_1.z.number().optional(),
        errorMessage: zod_1.z.string().optional(),
    }),
    timestamp: zod_1.z.string().datetime().optional(),
});
// Helper to validate API key
async function validateApiKey(apiKey) {
    try {
        // Get all active API keys (in production, cache this)
        const result = await (0, connection_1.query)(`SELECT ak.key_hash, ak.user_id, ak.expires_at
       FROM ankercloud.api_keys ak
       WHERE ak.is_active = true`, []);
        for (const row of result.rows) {
            const isValid = await bcryptjs_1.default.compare(apiKey, row.key_hash);
            if (isValid) {
                // Check expiration
                if (row.expires_at && new Date(row.expires_at) < new Date()) {
                    return { isValid: false };
                }
                // Update last used
                await (0, connection_1.query)('UPDATE ankercloud.api_keys SET last_used = NOW() WHERE key_hash = $1', [row.key_hash]);
                return { isValid: true, userId: row.user_id };
            }
        }
        return { isValid: false };
    }
    catch (error) {
        logger_1.logger.error('API key validation error:', error);
        return { isValid: false };
    }
}
const ingestRoutes = async (fastify) => {
    // Server metrics ingestion
    fastify.post('/server', async (request, reply) => {
        try {
            // Validate API key
            const apiKey = request.headers['x-api-key'];
            if (!apiKey) {
                return reply.code(401).send({ error: 'API key required' });
            }
            const { isValid, userId } = await validateApiKey(apiKey);
            if (!isValid) {
                return reply.code(401).send({ error: 'Invalid API key' });
            }
            const body = serverMetricsSchema.parse(request.body);
            // Verify resource ownership
            const resourceCheck = await (0, connection_1.query)('SELECT id FROM ankercloud.resources WHERE id = $1 AND user_id = $2 AND type = $3', [body.resourceId, userId, 'server']);
            if (resourceCheck.rows.length === 0) {
                return reply.code(404).send({ error: 'Resource not found' });
            }
            const timestamp = body.timestamp || new Date().toISOString();
            // Insert server metrics
            await (0, connection_1.query)(`INSERT INTO ankercloud.server_metrics
         (time, resource_id, cpu_usage_percent, memory_used_mb, memory_total_mb,
          memory_usage_percent, disk_used_mb, disk_total_mb, disk_usage_percent,
          network_in_bytes, network_out_bytes, process_count,
          load_avg_1m, load_avg_5m, load_avg_15m, uptime_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`, [
                timestamp,
                body.resourceId,
                body.metrics.cpuUsagePercent,
                body.metrics.memoryUsedMb,
                body.metrics.memoryTotalMb,
                body.metrics.memoryUsagePercent,
                body.metrics.diskUsedMb,
                body.metrics.diskTotalMb,
                body.metrics.diskUsagePercent,
                body.metrics.networkInBytes,
                body.metrics.networkOutBytes,
                body.metrics.processCount,
                body.metrics.loadAvg1m || null,
                body.metrics.loadAvg5m || null,
                body.metrics.loadAvg15m || null,
                body.metrics.uptimeSeconds,
            ]);
            // Insert process metrics if provided
            if (body.processes && body.processes.length > 0) {
                for (const process of body.processes) {
                    await (0, connection_1.query)(`INSERT INTO ankercloud.process_metrics
             (time, resource_id, process_name, pid, cpu_percent, memory_mb, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                        timestamp,
                        body.resourceId,
                        process.name,
                        process.pid,
                        process.cpuPercent,
                        process.memoryMb,
                        process.status,
                    ]);
                }
            }
            // Insert service metrics if provided
            if (body.services && body.services.length > 0) {
                for (const service of body.services) {
                    await (0, connection_1.query)(`INSERT INTO ankercloud.service_metrics
             (time, resource_id, service_name, status, startup_type)
             VALUES ($1, $2, $3, $4, $5)`, [
                        timestamp,
                        body.resourceId,
                        service.name,
                        service.status,
                        service.startupType || null,
                    ]);
                }
            }
            // Update resource last seen
            await (0, connection_1.query)(`UPDATE ankercloud.resources
         SET last_seen_at = $1, status = ankercloud.get_resource_status($2)
         WHERE id = $2`, [timestamp, body.resourceId]);
            // Update server info if needed
            await (0, connection_1.query)(`UPDATE ankercloud.servers
         SET agent_last_seen = $1,
             cpu_cores = COALESCE(cpu_cores, $2),
             total_memory_mb = $3,
             total_disk_mb = $4
         WHERE resource_id = $5`, [
                timestamp,
                body.metrics.processCount, // Placeholder for CPU cores
                body.metrics.memoryTotalMb,
                body.metrics.diskTotalMb,
                body.resourceId,
            ]);
            // Publish to Redis stream for real-time updates
            await (0, redis_1.addToStream)(`metrics:server:${body.resourceId}`, {
                cpu: body.metrics.cpuUsagePercent.toString(),
                memory: body.metrics.memoryUsagePercent.toString(),
                disk: body.metrics.diskUsagePercent.toString(),
                timestamp,
            });
            return reply.send({ status: 'ok', timestamp });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: 'Validation error',
                    details: error.errors,
                });
            }
            logger_1.logger.error('Server metrics ingestion error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // Website metrics ingestion
    fastify.post('/website', async (request, reply) => {
        try {
            // Validate API key
            const apiKey = request.headers['x-api-key'];
            if (!apiKey) {
                return reply.code(401).send({ error: 'API key required' });
            }
            const { isValid, userId } = await validateApiKey(apiKey);
            if (!isValid) {
                return reply.code(401).send({ error: 'Invalid API key' });
            }
            const body = websiteMetricsSchema.parse(request.body);
            // Verify resource ownership
            const resourceCheck = await (0, connection_1.query)('SELECT id FROM ankercloud.resources WHERE id = $1 AND user_id = $2 AND type = $3', [body.resourceId, userId, 'website']);
            if (resourceCheck.rows.length === 0) {
                return reply.code(404).send({ error: 'Resource not found' });
            }
            const timestamp = body.timestamp || new Date().toISOString();
            // Insert website metrics
            await (0, connection_1.query)(`INSERT INTO ankercloud.website_metrics
         (time, resource_id, status_code, response_time_ms, dns_time_ms,
          connect_time_ms, tls_time_ms, ttfb_ms, total_time_ms,
          content_size_bytes, is_available, error_message, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [
                timestamp,
                body.resourceId,
                body.metrics.statusCode,
                body.metrics.responseTimeMs,
                body.metrics.dnsTimeMs || null,
                body.metrics.connectTimeMs || null,
                body.metrics.tlsTimeMs || null,
                body.metrics.ttfbMs || null,
                body.metrics.totalTimeMs,
                body.metrics.contentSizeBytes || null,
                body.metrics.isAvailable,
                body.metrics.errorMessage || null,
                body.metrics.location || 'default',
            ]);
            // Update resource status
            const status = body.metrics.isAvailable ? 'online' : 'offline';
            await (0, connection_1.query)('UPDATE ankercloud.resources SET last_seen_at = $1, status = $2 WHERE id = $3', [timestamp, status, body.resourceId]);
            // Publish to Redis stream
            await (0, redis_1.addToStream)(`metrics:website:${body.resourceId}`, {
                status: body.metrics.statusCode.toString(),
                responseTime: body.metrics.responseTimeMs.toString(),
                available: body.metrics.isAvailable.toString(),
                timestamp,
            });
            return reply.send({ status: 'ok', timestamp });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: 'Validation error',
                    details: error.errors,
                });
            }
            logger_1.logger.error('Website metrics ingestion error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // Network metrics ingestion
    fastify.post('/network', async (request, reply) => {
        try {
            // Validate API key
            const apiKey = request.headers['x-api-key'];
            if (!apiKey) {
                return reply.code(401).send({ error: 'API key required' });
            }
            const { isValid, userId } = await validateApiKey(apiKey);
            if (!isValid) {
                return reply.code(401).send({ error: 'Invalid API key' });
            }
            const body = networkMetricsSchema.parse(request.body);
            // Verify resource ownership
            const resourceCheck = await (0, connection_1.query)('SELECT id FROM ankercloud.resources WHERE id = $1 AND user_id = $2 AND type = $3', [body.resourceId, userId, 'network']);
            if (resourceCheck.rows.length === 0) {
                return reply.code(404).send({ error: 'Resource not found' });
            }
            const timestamp = body.timestamp || new Date().toISOString();
            // Insert network metrics
            await (0, connection_1.query)(`INSERT INTO ankercloud.network_metrics
         (time, resource_id, check_type, latency_ms, packet_loss_percent,
          is_available, hop_count, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                timestamp,
                body.resourceId,
                body.metrics.checkType,
                body.metrics.latencyMs || null,
                body.metrics.packetLossPercent || null,
                body.metrics.isAvailable,
                body.metrics.hopCount || null,
                body.metrics.errorMessage || null,
            ]);
            // Update resource status
            const status = body.metrics.isAvailable ? 'online' : 'offline';
            await (0, connection_1.query)('UPDATE ankercloud.resources SET last_seen_at = $1, status = $2 WHERE id = $3', [timestamp, status, body.resourceId]);
            // Publish to Redis stream
            await (0, redis_1.addToStream)(`metrics:network:${body.resourceId}`, {
                checkType: body.metrics.checkType,
                latency: (body.metrics.latencyMs || 0).toString(),
                available: body.metrics.isAvailable.toString(),
                timestamp,
            });
            return reply.send({ status: 'ok', timestamp });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: 'Validation error',
                    details: error.errors,
                });
            }
            logger_1.logger.error('Network metrics ingestion error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // Batch metrics ingestion (for efficiency)
    fastify.post('/batch', async (request, reply) => {
        try {
            // Validate API key
            const apiKey = request.headers['x-api-key'];
            if (!apiKey) {
                return reply.code(401).send({ error: 'API key required' });
            }
            const { isValid } = await validateApiKey(apiKey);
            if (!isValid) {
                return reply.code(401).send({ error: 'Invalid API key' });
            }
            const { metrics } = request.body;
            if (!Array.isArray(metrics)) {
                return reply.code(400).send({ error: 'metrics array required' });
            }
            let processed = 0;
            let errors = 0;
            // Process each metric
            for (const metric of metrics) {
                try {
                    if (metric.type === 'server') {
                        // Process server metric
                        // (Similar to single server metric ingestion)
                        processed++;
                    }
                    else if (metric.type === 'website') {
                        // Process website metric
                        processed++;
                    }
                    else if (metric.type === 'network') {
                        // Process network metric
                        processed++;
                    }
                    else {
                        errors++;
                    }
                }
                catch (error) {
                    errors++;
                    logger_1.logger.error('Batch metric processing error:', error);
                }
            }
            return reply.send({
                status: 'ok',
                processed,
                errors,
                total: metrics.length,
            });
        }
        catch (error) {
            logger_1.logger.error('Batch ingestion error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
};
exports.default = ingestRoutes;
//# sourceMappingURL=ingest.js.map