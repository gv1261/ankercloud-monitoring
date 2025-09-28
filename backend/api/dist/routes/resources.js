"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const connection_1 = require("../database/connection");
const logger_1 = require("../utils/logger");
// Validation schemas
const createServerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    displayName: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    hostname: zod_1.z.string().optional(),
    ipAddress: zod_1.z.string().ip().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
const createWebsiteSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    displayName: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    url: zod_1.z.string().url(),
    method: zod_1.z.enum(['GET', 'POST', 'HEAD']).default('GET'),
    expectedStatusCode: zod_1.z.number().default(200),
    timeoutSeconds: zod_1.z.number().min(1).max(300).default(30),
    checkIntervalSeconds: zod_1.z.number().min(60).default(300),
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    sslCheck: zod_1.z.boolean().default(true),
    keywordCheck: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
const createNetworkSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    displayName: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    checkType: zod_1.z.enum(['ping', 'port', 'traceroute']),
    targetHost: zod_1.z.string().min(1),
    targetPort: zod_1.z.number().min(1).max(65535).optional(),
    checkIntervalSeconds: zod_1.z.number().min(30).default(60),
    timeoutSeconds: zod_1.z.number().min(1).max(60).default(10),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
const resourceRoutes = async (fastify) => {
    // Get all resources
    fastify.get('/', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        const userId = request.user.id;
        const { type, status, tags } = request.query;
        let queryText = `
      SELECT r.*,
        CASE
          WHEN r.type = 'server' THEN row_to_json(s.*)
          WHEN r.type = 'website' THEN row_to_json(w.*)
          WHEN r.type = 'network' THEN row_to_json(n.*)
        END as details
      FROM ankercloud.resources r
      LEFT JOIN ankercloud.servers s ON r.id = s.resource_id
      LEFT JOIN ankercloud.websites w ON r.id = w.resource_id
      LEFT JOIN ankercloud.network_checks n ON r.id = n.resource_id
      WHERE r.user_id = $1 AND r.is_active = true
    `;
        const params = [userId];
        let paramCount = 1;
        if (type) {
            paramCount++;
            queryText += ` AND r.type = $${paramCount}`;
            params.push(type);
        }
        if (status) {
            paramCount++;
            queryText += ` AND r.status = $${paramCount}`;
            params.push(status);
        }
        if (tags && Array.isArray(tags)) {
            paramCount++;
            queryText += ` AND r.tags @> $${paramCount}`;
            params.push(JSON.stringify(tags));
        }
        queryText += ' ORDER BY r.created_at DESC';
        const result = await (0, connection_1.query)(queryText, params);
        return reply.send({
            resources: result.rows.map(row => ({
                id: row.id,
                type: row.type,
                name: row.name,
                displayName: row.display_name,
                description: row.description,
                status: row.status,
                tags: row.tags,
                metadata: row.metadata,
                lastSeenAt: row.last_seen_at,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                details: row.details,
            })),
        });
    });
    // Get single resource
    fastify.get('/:id', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        const userId = request.user.id;
        const resourceId = request.params.id;
        const result = await (0, connection_1.query)(`SELECT r.*,
        CASE
          WHEN r.type = 'server' THEN row_to_json(s.*)
          WHEN r.type = 'website' THEN row_to_json(w.*)
          WHEN r.type = 'network' THEN row_to_json(n.*)
        END as details
      FROM ankercloud.resources r
      LEFT JOIN ankercloud.servers s ON r.id = s.resource_id
      LEFT JOIN ankercloud.websites w ON r.id = w.resource_id
      LEFT JOIN ankercloud.network_checks n ON r.id = n.resource_id
      WHERE r.id = $1 AND r.user_id = $2 AND r.is_active = true`, [resourceId, userId]);
        if (result.rows.length === 0) {
            return reply.code(404).send({ error: 'Resource not found' });
        }
        const row = result.rows[0];
        return reply.send({
            resource: {
                id: row.id,
                type: row.type,
                name: row.name,
                displayName: row.display_name,
                description: row.description,
                status: row.status,
                tags: row.tags,
                metadata: row.metadata,
                lastSeenAt: row.last_seen_at,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                details: row.details,
            },
        });
    });
    // Create server resource
    fastify.post('/servers', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        try {
            const userId = request.user.id;
            const body = createServerSchema.parse(request.body);
            const resource = await (0, connection_1.transaction)(async (client) => {
                // Create resource
                const resourceResult = await client.query(`INSERT INTO ankercloud.resources
           (user_id, type, name, display_name, description, tags)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`, [
                    userId,
                    'server',
                    body.name,
                    body.displayName || body.name,
                    body.description,
                    JSON.stringify(body.tags || []),
                ]);
                const resource = resourceResult.rows[0];
                // Create server details
                await client.query(`INSERT INTO ankercloud.servers
           (resource_id, hostname, ip_address)
           VALUES ($1, $2, $3)`, [resource.id, body.hostname, body.ipAddress]);
                return resource;
            });
            logger_1.logger.info(`Server resource created: ${resource.id}`);
            return reply.code(201).send({
                resource: {
                    id: resource.id,
                    type: resource.type,
                    name: resource.name,
                    displayName: resource.display_name,
                    description: resource.description,
                    tags: resource.tags,
                    createdAt: resource.created_at,
                },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: 'Validation error',
                    details: error.errors,
                });
            }
            logger_1.logger.error('Server creation error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // Create website resource
    fastify.post('/websites', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        try {
            const userId = request.user.id;
            const body = createWebsiteSchema.parse(request.body);
            const resource = await (0, connection_1.transaction)(async (client) => {
                // Create resource
                const resourceResult = await client.query(`INSERT INTO ankercloud.resources
           (user_id, type, name, display_name, description, tags)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`, [
                    userId,
                    'website',
                    body.name,
                    body.displayName || body.name,
                    body.description,
                    JSON.stringify(body.tags || []),
                ]);
                const resource = resourceResult.rows[0];
                // Create website details
                await client.query(`INSERT INTO ankercloud.websites
           (resource_id, url, method, expected_status_code, timeout_seconds,
            check_interval_seconds, headers, ssl_check, keyword_check)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
                    resource.id,
                    body.url,
                    body.method,
                    body.expectedStatusCode,
                    body.timeoutSeconds,
                    body.checkIntervalSeconds,
                    JSON.stringify(body.headers || {}),
                    body.sslCheck,
                    body.keywordCheck,
                ]);
                return resource;
            });
            logger_1.logger.info(`Website resource created: ${resource.id}`);
            return reply.code(201).send({
                resource: {
                    id: resource.id,
                    type: resource.type,
                    name: resource.name,
                    displayName: resource.display_name,
                    description: resource.description,
                    tags: resource.tags,
                    createdAt: resource.created_at,
                },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: 'Validation error',
                    details: error.errors,
                });
            }
            logger_1.logger.error('Website creation error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // Create network resource
    fastify.post('/networks', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        try {
            const userId = request.user.id;
            const body = createNetworkSchema.parse(request.body);
            const resource = await (0, connection_1.transaction)(async (client) => {
                // Create resource
                const resourceResult = await client.query(`INSERT INTO ankercloud.resources
           (user_id, type, name, display_name, description, tags)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`, [
                    userId,
                    'network',
                    body.name,
                    body.displayName || body.name,
                    body.description,
                    JSON.stringify(body.tags || []),
                ]);
                const resource = resourceResult.rows[0];
                // Create network check details
                await client.query(`INSERT INTO ankercloud.network_checks
           (resource_id, check_type, target_host, target_port,
            check_interval_seconds, timeout_seconds)
           VALUES ($1, $2, $3, $4, $5, $6)`, [
                    resource.id,
                    body.checkType,
                    body.targetHost,
                    body.targetPort,
                    body.checkIntervalSeconds,
                    body.timeoutSeconds,
                ]);
                return resource;
            });
            logger_1.logger.info(`Network resource created: ${resource.id}`);
            return reply.code(201).send({
                resource: {
                    id: resource.id,
                    type: resource.type,
                    name: resource.name,
                    displayName: resource.display_name,
                    description: resource.description,
                    tags: resource.tags,
                    createdAt: resource.created_at,
                },
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({
                    error: 'Validation error',
                    details: error.errors,
                });
            }
            logger_1.logger.error('Network creation error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // Update resource
    fastify.put('/:id', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        const userId = request.user.id;
        const resourceId = request.params.id;
        const updates = request.body;
        // Build update query dynamically
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        if (updates.displayName !== undefined) {
            updateFields.push(`display_name = $${paramCount++}`);
            values.push(updates.displayName);
        }
        if (updates.description !== undefined) {
            updateFields.push(`description = $${paramCount++}`);
            values.push(updates.description);
        }
        if (updates.tags !== undefined) {
            updateFields.push(`tags = $${paramCount++}`);
            values.push(JSON.stringify(updates.tags));
        }
        if (updates.metadata !== undefined) {
            updateFields.push(`metadata = $${paramCount++}`);
            values.push(JSON.stringify(updates.metadata));
        }
        if (updateFields.length === 0) {
            return reply.code(400).send({ error: 'No valid update fields provided' });
        }
        values.push(resourceId, userId);
        const result = await (0, connection_1.query)(`UPDATE ankercloud.resources
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING *`, values);
        if (result.rows.length === 0) {
            return reply.code(404).send({ error: 'Resource not found' });
        }
        logger_1.logger.info(`Resource updated: ${resourceId}`);
        return reply.send({
            resource: result.rows[0],
        });
    });
    // Delete resource
    fastify.delete('/:id', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        const userId = request.user.id;
        const resourceId = request.params.id;
        const result = await (0, connection_1.query)(`UPDATE ankercloud.resources
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`, [resourceId, userId]);
        if (result.rows.length === 0) {
            return reply.code(404).send({ error: 'Resource not found' });
        }
        logger_1.logger.info(`Resource deleted: ${resourceId}`);
        return reply.send({
            message: 'Resource deleted successfully',
        });
    });
    // Get resource metrics summary
    fastify.get('/:id/summary', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        const userId = request.user.id;
        const resourceId = request.params.id;
        const { period = '1h' } = request.query;
        // Verify resource ownership
        const resourceCheck = await (0, connection_1.query)('SELECT type FROM ankercloud.resources WHERE id = $1 AND user_id = $2', [resourceId, userId]);
        if (resourceCheck.rows.length === 0) {
            return reply.code(404).send({ error: 'Resource not found' });
        }
        const resourceType = resourceCheck.rows[0].type;
        let metricsQuery = '';
        if (resourceType === 'server') {
            metricsQuery = `
        SELECT
          AVG(cpu_usage_percent) as avg_cpu,
          MAX(cpu_usage_percent) as max_cpu,
          AVG(memory_usage_percent) as avg_memory,
          MAX(memory_usage_percent) as max_memory,
          AVG(disk_usage_percent) as avg_disk,
          MAX(disk_usage_percent) as max_disk,
          COUNT(*) as data_points
        FROM ankercloud.server_metrics
        WHERE resource_id = $1 AND time > NOW() - INTERVAL '${period}'
      `;
        }
        else if (resourceType === 'website') {
            metricsQuery = `
        SELECT
          AVG(response_time_ms) as avg_response_time,
          MAX(response_time_ms) as max_response_time,
          MIN(response_time_ms) as min_response_time,
          COUNT(*) as total_checks,
          SUM(CASE WHEN is_available THEN 1 ELSE 0 END) as successful_checks,
          (SUM(CASE WHEN is_available THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC * 100) as availability_percent
        FROM ankercloud.website_metrics
        WHERE resource_id = $1 AND time > NOW() - INTERVAL '${period}'
      `;
        }
        else if (resourceType === 'network') {
            metricsQuery = `
        SELECT
          AVG(latency_ms) as avg_latency,
          MAX(latency_ms) as max_latency,
          MIN(latency_ms) as min_latency,
          AVG(packet_loss_percent) as avg_packet_loss,
          COUNT(*) as total_checks,
          SUM(CASE WHEN is_available THEN 1 ELSE 0 END) as successful_checks
        FROM ankercloud.network_metrics
        WHERE resource_id = $1 AND time > NOW() - INTERVAL '${period}'
      `;
        }
        const result = await (0, connection_1.query)(metricsQuery, [resourceId]);
        return reply.send({
            summary: result.rows[0],
            period,
            resourceType,
        });
    });
};
exports.default = resourceRoutes;
//# sourceMappingURL=resources.js.map