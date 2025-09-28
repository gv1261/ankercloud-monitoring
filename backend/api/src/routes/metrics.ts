import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../database/connection';

interface MetricsRequest extends FastifyRequest {
  user: { id: string; role?: string; email?: string };
  params: { resourceId?: string; type?: string };
  query: {
    startTime?: string;
    endTime?: string;
    interval?: string;
  };
  body?: any;
}

const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  // --- Single resource metrics ---
  fastify.get('/:resourceId', { onRequest: [fastify.authenticate] }, async (request: MetricsRequest, reply: FastifyReply) => {
    const userId = request.user.id;
    const resourceId = request.params.resourceId!;
    const startTime = request.query.startTime || new Date(Date.now() - 3600000).toISOString();
    const endTime = request.query.endTime || new Date().toISOString();
    const interval = request.query.interval || '1m';

    // Fetch resource with ownership check
    const resourceCheck = request.user.role === 'admin'
      ? await query('SELECT id, name, type FROM ankercloud.resources WHERE id = $1', [resourceId])
      : await query('SELECT id, name, type FROM ankercloud.resources WHERE id = $1 AND user_id = $2', [resourceId, userId]);

    if (resourceCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Resource not found' });
    }

    const resource = resourceCheck.rows[0];
    let metricsData: any[] = [];

    if (resource.type === 'server') {
      const result = await query(
        `SELECT
          time_bucket($1::interval, time) AS bucket,
          AVG(cpu_usage_percent) AS cpu,
          AVG(memory_used_mb) AS memory_mb,
          AVG(disk_used_mb) AS disk_mb
        FROM ankercloud.server_metrics
        WHERE resource_id = $2
          AND time >= $3::timestamptz
          AND time <= $4::timestamptz
        GROUP BY bucket
        ORDER BY bucket ASC`,
        [interval, resource.id, startTime, endTime]
      );
      metricsData = result.rows;
    } else if (resource.type === 'website') {
      const result = await query(
        `SELECT
          time_bucket($1::interval, time) AS bucket,
          AVG(response_time_ms) AS response_time,
          AVG(dns_time_ms) AS dns_time,
          AVG(connect_time_ms) AS connect_time,
          AVG(ttfb_ms) AS ttfb,
          COUNT(*) AS checks,
          SUM(CASE WHEN is_available THEN 1 ELSE 0 END) AS successful
        FROM ankercloud.website_metrics
        WHERE resource_id = $2
          AND time >= $3::timestamptz
          AND time <= $4::timestamptz
        GROUP BY bucket
        ORDER BY bucket ASC`,
        [interval, resource.id, startTime, endTime]
      );
      metricsData = result.rows;
    } else if (resource.type === 'network') {
      const result = await query(
        `SELECT
          time_bucket($1::interval, time) AS bucket,
          AVG(latency_ms) AS latency,
          AVG(packet_loss_percent) AS packet_loss,
          COUNT(*) AS checks,
          SUM(CASE WHEN is_available THEN 1 ELSE 0 END) AS successful
        FROM ankercloud.network_metrics
        WHERE resource_id = $2
          AND time >= $3::timestamptz
          AND time <= $4::timestamptz
        GROUP BY bucket
        ORDER BY bucket ASC`,
        [interval, resource.id, startTime, endTime]
      );
      metricsData = result.rows;
    } else if (resource.type === 'database') {
      const result = await query(
        `SELECT
          time_bucket($1::interval, time) AS bucket,
          AVG(cpu_usage_percent) AS cpu,
          AVG(memory_used_mb) AS memory_mb,
          AVG(active_connections) AS connections
        FROM ankercloud.database_metrics
        WHERE resource_id = $2
          AND time >= $3::timestamptz
          AND time <= $4::timestamptz
        GROUP BY bucket
        ORDER BY bucket ASC`,
        [interval, resource.id, startTime, endTime]
      );
      metricsData = result.rows;
    }

    return reply.send({
      resourceId: resource.id,
      name: resource.name,
      resourceType: resource.type,
      startTime,
      endTime,
      interval,
      data: metricsData,
    });
  });

  // --- Metrics for all resources of a type ---
  fastify.get('/type/:type', { onRequest: [fastify.authenticate] }, async (request: MetricsRequest, reply: FastifyReply) => {
    const userId = request.user.id;
    const resourceType = request.params.type!;
    const startTime = request.query.startTime || new Date(Date.now() - 3600000).toISOString();
    const endTime = request.query.endTime || new Date().toISOString();
    const interval = request.query.interval || '1m';

    // Fetch resources by type
    const resources = request.user.role === 'admin'
      ? await query('SELECT id, name, type FROM ankercloud.resources WHERE type = $1', [resourceType])
      : await query('SELECT id, name, type FROM ankercloud.resources WHERE type = $1 AND user_id = $2', [resourceType, userId]);

    if (resources.rows.length === 0) {
      return reply.code(404).send({ error: 'No resources found' });
    }

    const metricsData: any[] = [];

    for (const resource of resources.rows) {
      let result;
      if (resource.type === 'server') {
        result = await query(
          `SELECT
            time_bucket($1::interval, time) AS bucket,
            AVG(cpu_usage_percent) AS cpu,
            AVG(memory_used_mb) AS memory_mb,
            AVG(disk_used_mb) AS disk_mb
          FROM ankercloud.server_metrics
          WHERE resource_id = $2
            AND time >= $3::timestamptz
            AND time <= $4::timestamptz
          GROUP BY bucket
          ORDER BY bucket ASC`,
          [interval, resource.id, startTime, endTime]
        );
      } else if (resource.type === 'website') {
        result = await query(
          `SELECT
            time_bucket($1::interval, time) AS bucket,
            AVG(response_time_ms) AS response_time,
            AVG(dns_time_ms) AS dns_time,
            AVG(connect_time_ms) AS connect_time,
            AVG(ttfb_ms) AS ttfb,
            COUNT(*) AS checks,
            SUM(CASE WHEN is_available THEN 1 ELSE 0 END) AS successful
          FROM ankercloud.website_metrics
          WHERE resource_id = $2
            AND time >= $3::timestamptz
            AND time <= $4::timestamptz
          GROUP BY bucket
          ORDER BY bucket ASC`,
          [interval, resource.id, startTime, endTime]
        );
      } else if (resource.type === 'network') {
        result = await query(
          `SELECT
            time_bucket($1::interval, time) AS bucket,
            AVG(latency_ms) AS latency,
            AVG(packet_loss_percent) AS packet_loss,
            COUNT(*) AS checks,
            SUM(CASE WHEN is_available THEN 1 ELSE 0 END) AS successful
          FROM ankercloud.network_metrics
          WHERE resource_id = $2
            AND time >= $3::timestamptz
            AND time <= $4::timestamptz
          GROUP BY bucket
          ORDER BY bucket ASC`,
          [interval, resource.id, startTime, endTime]
        );
      } else if (resource.type === 'database') {
        result = await query(
          `SELECT
            time_bucket($1::interval, time) AS bucket,
            AVG(cpu_usage_percent) AS cpu,
            AVG(memory_used_mb) AS memory_mb,
            AVG(active_connections) AS connections
          FROM ankercloud.database_metrics
          WHERE resource_id = $2
            AND time >= $3::timestamptz
            AND time <= $4::timestamptz
          GROUP BY bucket
          ORDER BY bucket ASC`,
          [interval, resource.id, startTime, endTime]
        );
      }

      metricsData.push({ resourceId: resource.id, name: resource.name, data: result.rows });
    }

    return reply.send({ resources: metricsData });
  });

  // --- Latest metrics for multiple resources ---
  fastify.post('/latest', { onRequest: [fastify.authenticate] }, async (request: MetricsRequest, reply: FastifyReply) => {
    const userId = request.user.id;
    const { resourceIds } = request.body as { resourceIds: string[] };

    if (!resourceIds || !Array.isArray(resourceIds)) {
      return reply.code(400).send({ error: 'resourceIds array required' });
    }

    // Verify resource ownership
    const resourceCheck =
      request.user.role === 'admin'
        ? await query(`SELECT id, name, type FROM ankercloud.resources WHERE id = ANY($1::uuid[])`, [resourceIds])
        : await query(
            `SELECT id, name, type FROM ankercloud.resources WHERE id = ANY($1::uuid[]) AND user_id = $2`,
            [resourceIds, userId]
          );

    const validResources = resourceCheck.rows;
    const latestMetrics: Record<string, any> = {};

    for (const resource of validResources) {
      let result;
      if (resource.type === 'server') {
        result = await query(
          `SELECT * FROM ankercloud.server_metrics
           WHERE resource_id = $1
           ORDER BY time DESC
           LIMIT 1`,
          [resource.id]
        );
      } else if (resource.type === 'website') {
        result = await query(
          `SELECT * FROM ankercloud.website_metrics
           WHERE resource_id = $1
           ORDER BY time DESC
           LIMIT 1`,
          [resource.id]
        );
      } else if (resource.type === 'network') {
        result = await query(
          `SELECT * FROM ankercloud.network_metrics
           WHERE resource_id = $1
           ORDER BY time DESC
           LIMIT 1`,
          [resource.id]
        );
      } else if (resource.type === 'database') {
        result = await query(
          `SELECT * FROM ankercloud.database_metrics
           WHERE resource_id = $1
           ORDER BY time DESC
           LIMIT 1`,
          [resource.id]
        );
      }

      if (result && result.rows.length > 0) {
        const row = result.rows[0];

        latestMetrics[resource.id] = {
          name: resource.name,
          type: resource.type,
          data: {
            cpu_usage_percent: row.cpu_usage_percent ?? 0,
            memory_used_mb: row.memory_used_mb ?? row.memory_usage_mb ?? 0,
            memory_total_mb: row.memory_total_mb ?? row.memory_total_mb ?? 0,
            disk_used_mb: row.disk_used_mb ?? 0,
            disk_total_mb: row.disk_total_mb ?? 0,
            network_usage_percent: row.network_usage_percent ?? 0,
            db_cpu_percent: row.db_cpu_percent ?? 0,
            time: row.time ?? new Date().toISOString(),
          },
        };
      }
    }

    return reply.send({ metrics: latestMetrics });
  });
};

export default metricsRoutes;
