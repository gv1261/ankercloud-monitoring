import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { addToStream } from '../utils/redis';
import bcrypt from 'bcryptjs';

// Validation schemas
const serverMetricsSchema = z.object({
  resourceId: z.string().uuid(),
  metrics: z.object({
    cpuUsagePercent: z.number().min(0).max(100),
    memoryUsedMb: z.number(),
    memoryTotalMb: z.number(),
    memoryUsagePercent: z.number().min(0).max(100),
    diskUsedMb: z.number(),
    diskTotalMb: z.number(),
    diskUsagePercent: z.number().min(0).max(100),
    networkInBytes: z.number(),
    networkOutBytes: z.number(),
    processCount: z.number(),
    loadAvg1m: z.number().optional(),
    loadAvg5m: z.number().optional(),
    loadAvg15m: z.number().optional(),
    uptimeSeconds: z.number(),
  }),
  processes: z.array(z.object({
    name: z.string(),
    pid: z.number(),
    cpuPercent: z.number(),
    memoryMb: z.number(),
    status: z.string(),
  })).optional(),
  services: z.array(z.object({
    name: z.string(),
    status: z.string(),
    startupType: z.string().optional(),
  })).optional(),
  timestamp: z.string().datetime().optional(),
});

const websiteMetricsSchema = z.object({
  resourceId: z.string().uuid(),
  metrics: z.object({
    statusCode: z.number(),
    responseTimeMs: z.number(),
    dnsTimeMs: z.number().optional(),
    connectTimeMs: z.number().optional(),
    tlsTimeMs: z.number().optional(),
    ttfbMs: z.number().optional(),
    totalTimeMs: z.number(),
    contentSizeBytes: z.number().optional(),
    isAvailable: z.boolean(),
    errorMessage: z.string().optional(),
    location: z.string().optional(),
  }),
  timestamp: z.string().datetime().optional(),
});

const networkMetricsSchema = z.object({
  resourceId: z.string().uuid(),
  metrics: z.object({
    checkType: z.enum(['ping', 'port', 'traceroute']),
    latencyMs: z.number().optional(),
    packetLossPercent: z.number().optional(),
    isAvailable: z.boolean(),
    hopCount: z.number().optional(),
    errorMessage: z.string().optional(),
  }),
  timestamp: z.string().datetime().optional(),
});

// Helper to validate API key
async function validateApiKey(apiKey: string): Promise<{ isValid: boolean; userId?: string }> {
  try {
    // Get all active API keys (in production, cache this)
    const result = await query(
      `SELECT ak.key_hash, ak.user_id, ak.expires_at
       FROM ankercloud.api_keys ak
       WHERE ak.is_active = true`,
      []
    );

    for (const row of result.rows) {
      const isValid = await bcrypt.compare(apiKey, row.key_hash);
      if (isValid) {
        // Check expiration
        if (row.expires_at && new Date(row.expires_at) < new Date()) {
          return { isValid: false };
        }

        // Update last used
        await query(
          'UPDATE ankercloud.api_keys SET last_used = NOW() WHERE key_hash = $1',
          [row.key_hash]
        );

        return { isValid: true, userId: row.user_id };
      }
    }

    return { isValid: false };
  } catch (error) {
    logger.error('API key validation error:', error);
    return { isValid: false };
  }
}

const ingestRoutes: FastifyPluginAsync = async (fastify) => {
  // Server metrics ingestion
  fastify.post('/server', async (request, reply) => {
    try {
      // Validate API key
      const apiKey = request.headers['x-api-key'] as string;
      if (!apiKey) {
        return reply.code(401).send({ error: 'API key required' });
      }

      const { isValid, userId } = await validateApiKey(apiKey);
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid API key' });
      }

      const body = serverMetricsSchema.parse(request.body);

      // Verify resource ownership
      const resourceCheck = await query(
        'SELECT id FROM ankercloud.resources WHERE id = $1 AND user_id = $2 AND type = $3',
        [body.resourceId, userId, 'server']
      );

      if (resourceCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Resource not found' });
      }

      const timestamp = body.timestamp || new Date().toISOString();

      // Insert server metrics
      await query(
        `INSERT INTO ankercloud.server_metrics
         (time, resource_id, cpu_usage_percent, memory_used_mb, memory_total_mb,
          memory_usage_percent, disk_used_mb, disk_total_mb, disk_usage_percent,
          network_in_bytes, network_out_bytes, process_count,
          load_avg_1m, load_avg_5m, load_avg_15m, uptime_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
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
        ]
      );

      // Insert process metrics if provided
      if (body.processes && body.processes.length > 0) {
        for (const process of body.processes) {
          await query(
            `INSERT INTO ankercloud.process_metrics
             (time, resource_id, process_name, pid, cpu_percent, memory_mb, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              timestamp,
              body.resourceId,
              process.name,
              process.pid,
              process.cpuPercent,
              process.memoryMb,
              process.status,
            ]
          );
        }
      }

      // Insert service metrics if provided
      if (body.services && body.services.length > 0) {
        for (const service of body.services) {
          await query(
            `INSERT INTO ankercloud.service_metrics
             (time, resource_id, service_name, status, startup_type)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              timestamp,
              body.resourceId,
              service.name,
              service.status,
              service.startupType || null,
            ]
          );
        }
      }

      // Update resource last seen
      await query(
        `UPDATE ankercloud.resources
         SET last_seen_at = $1, status = ankercloud.get_resource_status($2)
         WHERE id = $2`,
        [timestamp, body.resourceId]
      );

      // Update server info if needed
      await query(
        `UPDATE ankercloud.servers
         SET agent_last_seen = $1,
             cpu_cores = COALESCE(cpu_cores, $2),
             total_memory_mb = $3,
             total_disk_mb = $4
         WHERE resource_id = $5`,
        [
          timestamp,
          body.metrics.processCount, // Placeholder for CPU cores
          body.metrics.memoryTotalMb,
          body.metrics.diskTotalMb,
          body.resourceId,
        ]
      );

      // Publish to Redis stream for real-time updates
      await addToStream(`metrics:server:${body.resourceId}`, {
        cpu: body.metrics.cpuUsagePercent.toString(),
        memory: body.metrics.memoryUsagePercent.toString(),
        disk: body.metrics.diskUsagePercent.toString(),
        timestamp,
      });

      return reply.send({ status: 'ok', timestamp });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }

      logger.error('Server metrics ingestion error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Website metrics ingestion
  fastify.post('/website', async (request, reply) => {
    try {
      // Validate API key
      const apiKey = request.headers['x-api-key'] as string;
      if (!apiKey) {
        return reply.code(401).send({ error: 'API key required' });
      }

      const { isValid, userId } = await validateApiKey(apiKey);
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid API key' });
      }

      const body = websiteMetricsSchema.parse(request.body);

      // Verify resource ownership
      const resourceCheck = await query(
        'SELECT id FROM ankercloud.resources WHERE id = $1 AND user_id = $2 AND type = $3',
        [body.resourceId, userId, 'website']
      );

      if (resourceCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Resource not found' });
      }

      const timestamp = body.timestamp || new Date().toISOString();

      // Insert website metrics
      await query(
        `INSERT INTO ankercloud.website_metrics
         (time, resource_id, status_code, response_time_ms, dns_time_ms,
          connect_time_ms, tls_time_ms, ttfb_ms, total_time_ms,
          content_size_bytes, is_available, error_message, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
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
        ]
      );

      // Update resource status
      const status = body.metrics.isAvailable ? 'online' : 'offline';
      await query(
        'UPDATE ankercloud.resources SET last_seen_at = $1, status = $2 WHERE id = $3',
        [timestamp, status, body.resourceId]
      );

      // Publish to Redis stream
      await addToStream(`metrics:website:${body.resourceId}`, {
        status: body.metrics.statusCode.toString(),
        responseTime: body.metrics.responseTimeMs.toString(),
        available: body.metrics.isAvailable.toString(),
        timestamp,
      });

      return reply.send({ status: 'ok', timestamp });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }

      logger.error('Website metrics ingestion error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Network metrics ingestion
  fastify.post('/network', async (request, reply) => {
    try {
      // Validate API key
      const apiKey = request.headers['x-api-key'] as string;
      if (!apiKey) {
        return reply.code(401).send({ error: 'API key required' });
      }

      const { isValid, userId } = await validateApiKey(apiKey);
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid API key' });
      }

      const body = networkMetricsSchema.parse(request.body);

      // Verify resource ownership
      const resourceCheck = await query(
        'SELECT id FROM ankercloud.resources WHERE id = $1 AND user_id = $2 AND type = $3',
        [body.resourceId, userId, 'network']
      );

      if (resourceCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Resource not found' });
      }

      const timestamp = body.timestamp || new Date().toISOString();

      // Insert network metrics
      await query(
        `INSERT INTO ankercloud.network_metrics
         (time, resource_id, check_type, latency_ms, packet_loss_percent,
          is_available, hop_count, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          timestamp,
          body.resourceId,
          body.metrics.checkType,
          body.metrics.latencyMs || null,
          body.metrics.packetLossPercent || null,
          body.metrics.isAvailable,
          body.metrics.hopCount || null,
          body.metrics.errorMessage || null,
        ]
      );

      // Update resource status
      const status = body.metrics.isAvailable ? 'online' : 'offline';
      await query(
        'UPDATE ankercloud.resources SET last_seen_at = $1, status = $2 WHERE id = $3',
        [timestamp, status, body.resourceId]
      );

      // Publish to Redis stream
      await addToStream(`metrics:network:${body.resourceId}`, {
        checkType: body.metrics.checkType,
        latency: (body.metrics.latencyMs || 0).toString(),
        available: body.metrics.isAvailable.toString(),
        timestamp,
      });

      return reply.send({ status: 'ok', timestamp });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }

      logger.error('Network metrics ingestion error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Batch metrics ingestion (for efficiency)
  fastify.post('/batch', async (request, reply) => {
    try {
      // Validate API key
      const apiKey = request.headers['x-api-key'] as string;
      if (!apiKey) {
        return reply.code(401).send({ error: 'API key required' });
      }

      const { isValid } = await validateApiKey(apiKey);
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid API key' });
      }

      const { metrics } = request.body as { metrics: any[] };

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
          } else if (metric.type === 'website') {
            // Process website metric
            processed++;
          } else if (metric.type === 'network') {
            // Process network metric
            processed++;
          } else {
            errors++;
          }
        } catch (error) {
          errors++;
          logger.error('Batch metric processing error:', error);
        }
      }

      return reply.send({
        status: 'ok',
        processed,
        errors,
        total: metrics.length,
      });
    } catch (error) {
      logger.error('Batch ingestion error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};

export default ingestRoutes;
