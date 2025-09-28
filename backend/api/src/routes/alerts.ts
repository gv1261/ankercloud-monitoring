import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query, transaction } from '../database/connection';
import { logger } from '../utils/logger';

// Validation schemas
const createAlertPolicySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  resourceId: z.string().uuid(),
  metricName: z.string(),
  condition: z.enum(['gt', 'lt', 'eq', 'ne', 'gte', 'lte']),
  threshold: z.number(),
  durationSeconds: z.number().min(60).default(300),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  channelIds: z.array(z.string().uuid()).optional(),
});

const createNotificationChannelSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['email', 'webhook', 'sms', 'slack']),
  configuration: z.object({
    email: z.string().email().optional(),
    url: z.string().url().optional(),
    phone: z.string().optional(),
    webhookSecret: z.string().optional(),
  }),
});

const alertRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all alert policies
  fastify.get('/policies', {
    onRequest: [fastify.authenticate],
  }, async (request: any, reply) => {
    const userId = request.user.id;

    const result = await query(
      `SELECT ap.*, r.name as resource_name, r.type as resource_type,
        array_agg(nc.name) as channel_names
       FROM ankercloud.alert_policies ap
       LEFT JOIN ankercloud.resources r ON ap.resource_id = r.id
       LEFT JOIN ankercloud.alert_policy_channels apc ON ap.id = apc.alert_policy_id
       LEFT JOIN ankercloud.notification_channels nc ON apc.channel_id = nc.id
       WHERE ap.user_id = $1
       GROUP BY ap.id, r.name, r.type
       ORDER BY ap.created_at DESC`,
      [userId]
    );

    return reply.send({
      policies: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        resourceId: row.resource_id,
        resourceName: row.resource_name,
        resourceType: row.resource_type,
        metricName: row.metric_name,
        condition: row.condition,
        threshold: row.threshold,
        durationSeconds: row.duration_seconds,
        severity: row.severity,
        isActive: row.is_active,
        channels: row.channel_names?.filter(Boolean) || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  });

  // Create alert policy
  fastify.post('/policies', {
    onRequest: [fastify.authenticate],
  }, async (request: any, reply) => {
    try {
      const userId = request.user.id;
      const body = createAlertPolicySchema.parse(request.body);

      // Verify resource ownership
      const resourceCheck = await query(
        'SELECT id FROM ankercloud.resources WHERE id = $1 AND user_id = $2',
        [body.resourceId, userId]
      );

      if (resourceCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Resource not found' });
      }

      const policy = await transaction(async (client) => {
        // Create policy
        const policyResult = await client.query(
          `INSERT INTO ankercloud.alert_policies
           (user_id, name, description, resource_id, metric_name,
            condition, threshold, duration_seconds, severity)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            userId,
            body.name,
            body.description,
            body.resourceId,
            body.metricName,
            body.condition,
            body.threshold,
            body.durationSeconds,
            body.severity,
          ]
        );

        const policy = policyResult.rows[0];

        // Link channels if provided
        if (body.channelIds && body.channelIds.length > 0) {
          for (const channelId of body.channelIds) {
            await client.query(
              `INSERT INTO ankercloud.alert_policy_channels
               (alert_policy_id, channel_id)
               VALUES ($1, $2)`,
              [policy.id, channelId]
            );
          }
        }

        return policy;
      });

      logger.info(`Alert policy created: ${policy.id}`);

      return reply.code(201).send({
        policy: {
          id: policy.id,
          name: policy.name,
          description: policy.description,
          resourceId: policy.resource_id,
          metricName: policy.metric_name,
          condition: policy.condition,
          threshold: policy.threshold,
          durationSeconds: policy.duration_seconds,
          severity: policy.severity,
          isActive: policy.is_active,
          createdAt: policy.created_at,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }

      logger.error('Alert policy creation error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Delete alert policy
  fastify.delete('/policies/:id', {
    onRequest: [fastify.authenticate],
  }, async (request: any, reply) => {
    const userId = request.user.id;
    const policyId = request.params.id;

    const result = await query(
      `UPDATE ankercloud.alert_policies
       SET is_active = false
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [policyId, userId]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Alert policy not found' });
    }

    logger.info(`Alert policy deleted: ${policyId}`);

    return reply.send({
      message: 'Alert policy deleted successfully',
    });
  });

  // Get notification channels
  fastify.get('/channels', {
    onRequest: [fastify.authenticate],
  }, async (request: any, reply) => {
    const userId = request.user.id;

    const result = await query(
      `SELECT id, name, type, is_active, created_at
       FROM ankercloud.notification_channels
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return reply.send({
      channels: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        isActive: row.is_active,
        createdAt: row.created_at,
      })),
    });
  });

  // Create notification channel
  fastify.post('/channels', {
    onRequest: [fastify.authenticate],
  }, async (request: any, reply) => {
    try {
      const userId = request.user.id;
      const body = createNotificationChannelSchema.parse(request.body);

      const result = await query(
        `INSERT INTO ankercloud.notification_channels
         (user_id, name, type, configuration)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, type, is_active, created_at`,
        [
          userId,
          body.name,
          body.type,
          JSON.stringify(body.configuration),
        ]
      );

      const channel = result.rows[0];

      logger.info(`Notification channel created: ${channel.id}`);

      return reply.code(201).send({
        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          isActive: channel.is_active,
          createdAt: channel.created_at,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }

      logger.error('Channel creation error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get incidents
fastify.get('/incidents', {
  onRequest: [fastify.authenticate],
}, async (request: any, reply) => {
  const userId = request.user.id;
  const { state, severity, resourceId } = request.query as any;

  let queryText = `
    SELECT i.*, ap.name as policy_name, r.name as resource_name, r.type as resource_type
    FROM ankercloud.incidents i
    JOIN ankercloud.alert_policies ap ON i.alert_policy_id = ap.id
    JOIN ankercloud.resources r ON i.resource_id = r.id
    WHERE ap.user_id = $1
  `;

  const params: any[] = [userId];
  let paramCount = 1;

  if (state) {
    paramCount++;
    queryText += ` AND i.state = $${paramCount}`;
    params.push(state);
  }

  if (severity) {
    paramCount++;
    queryText += ` AND i.severity = $${paramCount}`;
    params.push(severity);
  }

  if (resourceId) {
    paramCount++;
    queryText += ` AND i.resource_id = $${paramCount}`;
    params.push(resourceId);
  }

  queryText += ' ORDER BY i.triggered_at DESC LIMIT 100';

  const result = await query(queryText, params);

  return reply.send({
    incidents: result.rows.map(row => ({
      id: row.id,
      policyId: row.alert_policy_id,
      policyName: row.policy_name,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      resourceType: row.resource_type,
      state: row.state,
      severity: row.severity,
      triggeredValue: row.triggered_value,
      triggeredAt: row.triggered_at,
      resolvedAt: row.resolved_at,
      acknowledgedAt: row.acknowledged_at,
      notes: row.notes,
    })),
  });
});


  // Acknowledge incident
  fastify.post('/incidents/:id/acknowledge', {
    onRequest: [fastify.authenticate],
  }, async (request: any, reply) => {
    const userId = request.user.id;
    const incidentId = request.params.id;
    const { notes } = request.body as { notes?: string };

    // Verify incident ownership
    const incidentCheck = await query(
      `SELECT i.id FROM ankercloud.incidents i
       JOIN ankercloud.alert_policies ap ON i.alert_policy_id = ap.id
       WHERE i.id = $1 AND ap.user_id = $2`,
      [incidentId, userId]
    );

    if (incidentCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Incident not found' });
    }

    await transaction(async (client) => {
      // Update incident
      await client.query(
        `UPDATE ankercloud.incidents
         SET state = 'acknowledged',
             acknowledged_at = NOW(),
             acknowledged_by = $1,
             notes = COALESCE(notes || E'\\n' || $2, $2)
         WHERE id = $3`,
        [userId, notes, incidentId]
      );

      // Add to history
      await client.query(
        `INSERT INTO ankercloud.incident_history
         (incident_id, action, performed_by, details)
         VALUES ($1, $2, $3, $4)`,
        [
          incidentId,
          'acknowledged',
          userId,
          JSON.stringify({ notes }),
        ]
      );
    });

    logger.info(`Incident acknowledged: ${incidentId}`);

    return reply.send({
      message: 'Incident acknowledged successfully',
    });
  });

  // Resolve incident
  fastify.post('/incidents/:id/resolve', {
    onRequest: [fastify.authenticate],
  }, async (request: any, reply) => {
    const userId = request.user.id;
    const incidentId = request.params.id;
    const { notes } = request.body as { notes?: string };

    // Verify incident ownership
    const incidentCheck = await query(
      `SELECT i.id FROM ankercloud.incidents i
       JOIN ankercloud.alert_policies ap ON i.alert_policy_id = ap.id
       WHERE i.id = $1 AND ap.user_id = $2`,
      [incidentId, userId]
    );

    if (incidentCheck.rows.length === 0) {
      return reply.code(404).send({ error: 'Incident not found' });
    }

    await transaction(async (client) => {
      // Update incident
      await client.query(
        `UPDATE ankercloud.incidents
         SET state = 'resolved',
             resolved_at = NOW(),
             notes = COALESCE(notes || E'\\n' || $1, $1)
         WHERE id = $2`,
        [notes, incidentId]
      );

      // Add to history
      await client.query(
        `INSERT INTO ankercloud.incident_history
         (incident_id, action, performed_by, details)
         VALUES ($1, $2, $3, $4)`,
        [
          incidentId,
          'resolved',
          userId,
          JSON.stringify({ notes }),
        ]
      );
    });

    logger.info(`Incident resolved: ${incidentId}`);

    return reply.send({
      message: 'Incident resolved successfully',
    });
  });
};

export default alertRoutes;
