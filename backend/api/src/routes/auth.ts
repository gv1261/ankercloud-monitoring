import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../database/connection';
import { config } from '../config';
import { logger } from '../utils/logger';

// Validation schemas
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

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register new user
  fastify.post('/register', async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);

      // Check if user exists
      const existingUser = await query(
        'SELECT id FROM ankercloud.users WHERE email = $1',
        [body.email]
      );

      if (existingUser.rows.length > 0) {
        return reply.code(400).send({
          error: 'User with this email already exists',
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(body.password, 10);

      // Create user
      const result = await query(
        `INSERT INTO ankercloud.users (email, password_hash, full_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, full_name, role, created_at`,
        [body.email, passwordHash, body.fullName]
      );

      const user = result.rows[0];

      // Generate JWT token
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
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }

      logger.error('Registration error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
      });
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);

      // Get user
      const result = await query(
        `SELECT id, email, password_hash, full_name, role, is_active
         FROM ankercloud.users
         WHERE email = $1`,
        [body.email]
      );

      if (result.rows.length === 0) {
        return reply.code(401).send({
          error: 'Invalid email or password',
        });
      }

      const user = result.rows[0];

      // Check if user is active
      if (!user.is_active) {
        return reply.code(403).send({
          error: 'Account is disabled',
        });
      }

      // Verify password
      const validPassword = await bcrypt.compare(body.password, user.password_hash);

      if (!validPassword) {
        return reply.code(401).send({
          error: 'Invalid email or password',
        });
      }

      // Update last login
      await query(
        'UPDATE ankercloud.users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Generate JWT token
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
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }

      logger.error('Login error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
      });
    }
  });

  // Verify token
  fastify.get('/verify', {
    onRequest: [fastify.authenticate],
  }, async (request: any, reply) => {
    const userId = request.user.id;

    const result = await query(
      `SELECT id, email, full_name, role
       FROM ankercloud.users
       WHERE id = $1 AND is_active = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return reply.code(401).send({
        error: 'Invalid token',
      });
    }

    const user = result.rows[0];

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
  });

  // Create API key
  fastify.post('/api-keys', {
    onRequest: [fastify.authenticate],
  }, async (request: any, reply) => {
    try {
      const body = createApiKeySchema.parse(request.body);
      const userId = request.user.id;

      // Generate API key
      const apiKey = `${config.api.keyPrefix}${uuidv4().replace(/-/g, '')}`;
      const keyHash = await bcrypt.hash(apiKey, 10);

      // Store API key
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
          key: apiKey, // Only shown once
          name: apiKeyRecord.name,
          permissions: apiKeyRecord.permissions,
          expiresAt: apiKeyRecord.expires_at,
          createdAt: apiKeyRecord.created_at,
        },
        message: 'Save this API key securely. It will not be shown again.',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }

      logger.error('API key creation error:', error);
      return reply.code(500).send({
        error: 'Internal server error',
      });
    }
  });

  // List API keys
  fastify.get('/api-keys', {
    onRequest: [fastify.authenticate],
  }, async (request: any, reply) => {
    const userId = request.user.id;

    const result = await query(
      `SELECT id, name, permissions, last_used, expires_at, is_active, created_at
       FROM ankercloud.api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return reply.send({
      apiKeys: result.rows.map(key => ({
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

  // Revoke API key
  fastify.delete('/api-keys/:id', {
    onRequest: [fastify.authenticate],
  }, async (request: any, reply) => {
    const userId = request.user.id;
    const keyId = request.params.id;

    const result = await query(
      `UPDATE ankercloud.api_keys
       SET is_active = false
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [keyId, userId]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({
        error: 'API key not found',
      });
    }

    logger.info(`API key revoked: ${keyId} by user ${userId}`);

    return reply.send({
      message: 'API key revoked successfully',
    });
  });

  // Logout (client-side token removal, but we can track it)
  fastify.post('/logout', {
    onRequest: [fastify.authenticate],
  }, async (request: any, reply) => {
    const userId = request.user.id;

    // Log the logout event
    await query(
      `INSERT INTO ankercloud.audit_logs (user_id, action, details)
       VALUES ($1, $2, $3)`,
      [userId, 'logout', JSON.stringify({ timestamp: new Date() })]
    );

    logger.info(`User logged out: ${request.user.email}`);

    return reply.send({
      message: 'Logged out successfully',
    });
  });
};

export default authRoutes;
