import { FastifyPluginAsync } from 'fastify';
import type { FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../database/connection';
import { config } from '../config';
import { logger } from '../utils/logger';

// ------------------- Types -------------------
export interface JwtPayload {
  id: string;
  email?: string;
  role?: string;
}

export interface AuthRequest {
  user?: { id: string; email: string };
};
interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  password_hash?: string | null;
  is_active?: boolean;
}

// ------------------- Zod Schemas -------------------
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const createApiKeySchema = z.object({
  name: z.string().min(1),
  permissions: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});

// ------------------- Plugin -------------------
const authRoutes: FastifyPluginAsync = async (fastify) => {
  // JWT authenticate decorator
fastify.decorate(
  'authenticate',
  async (request, reply) => {
  try {
  const user = (await request.jwtVerify()) as JwtPayload;
    (request as any).user = user;
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}
);
  // ----------- Register -----------
  fastify.post('/register', async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);
      const existingUser = await query(
        'SELECT id FROM ankercloud.users WHERE email = $1',
        [body.email]
      );

      if (existingUser.rows.length > 0) {
        return reply.code(400).send({ error: 'User with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(body.password, 10);

      const result = await query(
        `INSERT INTO ankercloud.users (email, password_hash, full_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, full_name, role, created_at`,
        [body.email, passwordHash, body.fullName]
      );

      const user: UserRow = result.rows[0];

      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      logger.info(`New user registered: ${user.email}`);

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
        },
        token,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      logger.error('Registration error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ----------- Login -----------
  fastify.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);

      const result = await query(
        `SELECT id, email, password_hash, full_name, role, is_active
         FROM ankercloud.users
         WHERE email = $1`,
        [body.email]
      );

      if (result.rows.length === 0) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      const user: UserRow = result.rows[0];

      if (!user.is_active) {
        return reply.code(403).send({ error: 'Account is disabled' });
      }

      const validPassword = await bcrypt.compare(body.password, user.password_hash ?? '');
      if (!validPassword) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      await query('UPDATE ankercloud.users SET last_login = NOW() WHERE id = $1', [user.id]);

      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      logger.info(`User logged in: ${user.email}`);

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
        },
        token,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      logger.error('Login error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ----------- Verify Token -----------
  fastify.get('/verify', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const userId = authRequest.user.id;

    const result = await query(
      `SELECT id, email, full_name, role
       FROM ankercloud.users
       WHERE id = $1 AND is_active = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return reply.code(401).send({ error: 'Invalid token' });
    }

    const user: UserRow = result.rows[0];

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
  });

  // ----------- Create API Key -----------
  fastify.post('/api-keys', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    try {
      const authRequest = request as AuthRequest;
      const body = createApiKeySchema.parse(request.body);
      const userId = authRequest.user.id;

      const apiKey = `${config.api.keyPrefix}${uuidv4().replace(/-/g, '')}`;
      const keyHash = await bcrypt.hash(apiKey, 10);

      const result = await query(
        `INSERT INTO ankercloud.api_keys
         (user_id, key_hash, name, permissions, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, permissions, expires_at, created_at`,
        [
          userId,
          keyHash,
          body.name,
          JSON.stringify(body.permissions || []),
          body.expiresAt || null,
        ]
      );

      const apiKeyRecord = result.rows[0];

      logger.info(`API key created for user ${userId}: ${apiKeyRecord.name}`);

      return reply.send({
        apiKey: {
          id: apiKeyRecord.id,
          key: apiKey,
          name: apiKeyRecord.name,
          permissions: apiKeyRecord.permissions,
          expiresAt: apiKeyRecord.expires_at,
          createdAt: apiKeyRecord.created_at,
        },
        message: 'Save this API key securely. It will not be shown again.',
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      logger.error('API key creation error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ----------- List API Keys -----------
  fastify.get('/api-keys', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const userId = authRequest.user.id;

    const result = await query(
      `SELECT id, name, permissions, last_used, expires_at, is_active, created_at
       FROM ankercloud.api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return reply.send({
      apiKeys: result.rows.map((key: any) => ({
        id: key.id,
        name: key.name,
        permissions: key.permissions,
        lastUsed: key.last_used,
        expiresAt: key.expires_at,
        isActive: key.is_active,
        createdAt: key.created_at,
      })),
    });
  });

  // ----------- Revoke API Key -----------
  fastify.delete('/api-keys/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const userId = authRequest.user.id;
    const keyId = (request.params as { id: string }).id;

    const result = await query(
      `UPDATE ankercloud.api_keys
       SET is_active = false
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [keyId, userId]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'API key not found' });
    }

    logger.info(`API key revoked: ${keyId} by user ${userId}`);

    return reply.send({ message: 'API key revoked successfully' });
  });

  // ----------- Logout -----------
  fastify.post('/logout', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const authRequest = request as AuthRequest;
    const userId = authRequest.user.id;

    await query(
      `INSERT INTO ankercloud.audit_logs (user_id, action, details)
       VALUES ($1, $2, $3)`,
      [userId, 'logout', JSON.stringify({ timestamp: new Date() })]
    );

    logger.info(`User logged out: ${authRequest.user.email}`);

    return reply.send({ message: 'Logged out successfully' });
  });
};
export default authRoutes;