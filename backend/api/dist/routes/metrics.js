"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("../database/connection");
const metricsRoutes = async (fastify) => {
    // Get metrics for a resource
    fastify.get('/:resourceId', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        const userId = request.user.id;
        const resourceId = request.params.resourceId;
        const { startTime = new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        endTime = new Date().toISOString(), interval = '1m' } = request.query;
        // Verify resource ownership
        const resourceCheck = await (0, connection_1.query)('SELECT type FROM ankercloud.resources WHERE id = $1 AND user_id = $2', [resourceId, userId]);
        if (resourceCheck.rows.length === 0) {
            return reply.code(404).send({ error: 'Resource not found' });
        }
        const resourceType = resourceCheck.rows[0].type;
        let metricsData;
        if (resourceType === 'server') {
            const result = await (0, connection_1.query)(`SELECT
          time_bucket($1::interval, time) AS bucket,
          AVG(cpu_usage_percent) as cpu,
          AVG(memory_usage_percent) as memory,
          AVG(disk_usage_percent) as disk,
          MAX(network_in_bytes) as network_in,
          MAX(network_out_bytes) as network_out
        FROM ankercloud.server_metrics
        WHERE resource_id = $2
          AND time >= $3::timestamptz
          AND time <= $4::timestamptz
        GROUP BY bucket
        ORDER BY bucket ASC`, [interval, resourceId, startTime, endTime]);
            metricsData = result.rows;
        }
        else if (resourceType === 'website') {
            const result = await (0, connection_1.query)(`SELECT
          time_bucket($1::interval, time) AS bucket,
          AVG(response_time_ms) as response_time,
          AVG(dns_time_ms) as dns_time,
          AVG(connect_time_ms) as connect_time,
          AVG(ttfb_ms) as ttfb,
          COUNT(*) as checks,
          SUM(CASE WHEN is_available THEN 1 ELSE 0 END) as successful
        FROM ankercloud.website_metrics
        WHERE resource_id = $2
          AND time >= $3::timestamptz
          AND time <= $4::timestamptz
        GROUP BY bucket
        ORDER BY bucket ASC`, [interval, resourceId, startTime, endTime]);
            metricsData = result.rows;
        }
        else if (resourceType === 'network') {
            const result = await (0, connection_1.query)(`SELECT
          time_bucket($1::interval, time) AS bucket,
          AVG(latency_ms) as latency,
          AVG(packet_loss_percent) as packet_loss,
          COUNT(*) as checks,
          SUM(CASE WHEN is_available THEN 1 ELSE 0 END) as successful
        FROM ankercloud.network_metrics
        WHERE resource_id = $2
          AND time >= $3::timestamptz
          AND time <= $4::timestamptz
        GROUP BY bucket
        ORDER BY bucket ASC`, [interval, resourceId, startTime, endTime]);
            metricsData = result.rows;
        }
        return reply.send({
            resourceId,
            resourceType,
            startTime,
            endTime,
            interval,
            data: metricsData,
        });
    });
    // Get latest metrics for multiple resources
    fastify.post('/latest', {
        onRequest: [fastify.authenticate],
    }, async (request, reply) => {
        const userId = request.user.id;
        const { resourceIds } = request.body;
        if (!resourceIds || !Array.isArray(resourceIds)) {
            return reply.code(400).send({ error: 'resourceIds array required' });
        }
        // Verify resource ownership
        const resourceCheck = await (0, connection_1.query)(`SELECT id, type FROM ankercloud.resources
       WHERE id = ANY($1::uuid[]) AND user_id = $2`, [resourceIds, userId]);
        const validResources = resourceCheck.rows;
        const latestMetrics = {};
        for (const resource of validResources) {
            if (resource.type === 'server') {
                const result = await (0, connection_1.query)(`SELECT * FROM ankercloud.server_metrics
           WHERE resource_id = $1
           ORDER BY time DESC
           LIMIT 1`, [resource.id]);
                if (result.rows.length > 0) {
                    latestMetrics[resource.id] = {
                        type: 'server',
                        data: result.rows[0],
                    };
                }
            }
            else if (resource.type === 'website') {
                const result = await (0, connection_1.query)(`SELECT * FROM ankercloud.website_metrics
           WHERE resource_id = $1
           ORDER BY time DESC
           LIMIT 1`, [resource.id]);
                if (result.rows.length > 0) {
                    latestMetrics[resource.id] = {
                        type: 'website',
                        data: result.rows[0],
                    };
                }
            }
            else if (resource.type === 'network') {
                const result = await (0, connection_1.query)(`SELECT * FROM ankercloud.network_metrics
           WHERE resource_id = $1
           ORDER BY time DESC
           LIMIT 1`, [resource.id]);
                if (result.rows.length > 0) {
                    latestMetrics[resource.id] = {
                        type: 'network',
                        data: result.rows[0],
                    };
                }
            }
        }
        return reply.send({
            metrics: latestMetrics,
        });
    });
};
exports.default = metricsRoutes;
//# sourceMappingURL=metrics.js.map