import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../database/connection';

interface IncidentsRequest extends FastifyRequest {
  user: { id: string; role?: string; email?: string };
}

const incidentsRoutes: FastifyPluginAsync = async (fastify) => {
  // --- Get all incidents ---
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (request: IncidentsRequest, reply: FastifyReply) => {
    const userId = request.user.id;

    // Fetch incidents (no resource_name)
    const incidentsQuery = request.user.role === 'admin'
      ? `SELECT id, severity, message, triggered_at, state
         FROM ankercloud.incidents
         ORDER BY triggered_at DESC`
      : `SELECT id, severity, message, triggered_at, state 
         FROM ankercloud.incidents 
         WHERE user_id = $1 
         ORDER BY triggered_at DESC`;

    const result = request.user.role === 'admin'
      ? await query(incidentsQuery)
      : await query(incidentsQuery, [userId]);

    const incidents = result.rows.map(row => ({
      id: row.id,
      severity: row.severity,
      message: row.message,
      triggeredAt: row.triggered_at,
      state: row.state,
    }));

    return reply.send({ data: incidents });
  });
};

export default incidentsRoutes;
