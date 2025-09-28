"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const zod_1 = require("zod");
const connection_1 = require("../database/connection");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
;
// ------------------- Zod Schemas -------------------
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    fullName: zod_1.z.string().min(1),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
const createApiKeySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    permissions: zod_1.z.array(zod_1.z.string()).optional(),
    expiresAt: zod_1.z.string().datetime().optional(),
});
// ------------------- Plugin -------------------
const authRoutes = async (fastify) => {
    // JWT authenticate decorator
    fastify.decorate('authenticate', async (request, reply) => {
        try {
            const user = (await request.jwtVerify());
            request.user = user;
        }
        catch (err) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
    });
    // ----------- Register -----------
    fastify.post('/register', async (request, reply) => {
        try {
            const body = registerSchema.parse(request.body);
            const existingUser = await (0, connection_1.query)('SELECT id FROM ankercloud.users WHERE email = $1', [body.email]);
            if (existingUser.rows.length > 0) {
                return reply.code(400).send({ error: 'User with this email already exists' });
            }
            const passwordHash = await bcryptjs_1.default.hash(body.password, 10);
            const result = await (0, connection_1.query)(`INSERT INTO ankercloud.users (email, password_hash, full_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, full_name, role, created_at`, [body.email, passwordHash, body.fullName]);
            const user = result.rows[0];
            const token = fastify.jwt.sign({
                id: user.id,
                email: user.email,
                role: user.role,
            });
            logger_1.logger.info(`New user registered: ${user.email}`);
            return reply.send({
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                },
                token,
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({ error: 'Validation error', details: error.errors });
            }
            logger_1.logger.error('Registration error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // ----------- Login -----------
    fastify.post('/login', async (request, reply) => {
        try {
            const body = loginSchema.parse(request.body);
            const result = await (0, connection_1.query)(`SELECT id, email, password_hash, full_name, role, is_active
         FROM ankercloud.users
         WHERE email = $1`, [body.email]);
            if (result.rows.length === 0) {
                return reply.code(401).send({ error: 'Invalid email or password' });
            }
            const user = result.rows[0];
            if (!user.is_active) {
                return reply.code(403).send({ error: 'Account is disabled' });
            }
            const validPassword = await bcryptjs_1.default.compare(body.password, user.password_hash ?? '');
            if (!validPassword) {
                return reply.code(401).send({ error: 'Invalid email or password' });
            }
            await (0, connection_1.query)('UPDATE ankercloud.users SET last_login = NOW() WHERE id = $1', [user.id]);
            const token = fastify.jwt.sign({
                id: user.id,
                email: user.email,
                role: user.role,
            });
            logger_1.logger.info(`User logged in: ${user.email}`);
            return reply.send({
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                },
                token,
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({ error: 'Validation error', details: error.errors });
            }
            logger_1.logger.error('Login error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // ----------- Verify Token -----------
    fastify.get('/verify', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const authRequest = request;
        const userId = authRequest.user.id;
        const result = await (0, connection_1.query)(`SELECT id, email, full_name, role
       FROM ankercloud.users
       WHERE id = $1 AND is_active = true`, [userId]);
        if (result.rows.length === 0) {
            return reply.code(401).send({ error: 'Invalid token' });
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
    // ----------- Create API Key -----------
    fastify.post('/api-keys', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        try {
            const authRequest = request;
            const body = createApiKeySchema.parse(request.body);
            const userId = authRequest.user.id;
            const apiKey = `${config_1.config.api.keyPrefix}${(0, uuid_1.v4)().replace(/-/g, '')}`;
            const keyHash = await bcryptjs_1.default.hash(apiKey, 10);
            const result = await (0, connection_1.query)(`INSERT INTO ankercloud.api_keys
         (user_id, key_hash, name, permissions, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, permissions, expires_at, created_at`, [
                userId,
                keyHash,
                body.name,
                JSON.stringify(body.permissions || []),
                body.expiresAt || null,
            ]);
            const apiKeyRecord = result.rows[0];
            logger_1.logger.info(`API key created for user ${userId}: ${apiKeyRecord.name}`);
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
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({ error: 'Validation error', details: error.errors });
            }
            logger_1.logger.error('API key creation error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // ----------- List API Keys -----------
    fastify.get('/api-keys', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const authRequest = request;
        const userId = authRequest.user.id;
        const result = await (0, connection_1.query)(`SELECT id, name, permissions, last_used, expires_at, is_active, created_at
       FROM ankercloud.api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`, [userId]);
        return reply.send({
            apiKeys: result.rows.map((key) => ({
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
        const authRequest = request;
        const userId = authRequest.user.id;
        const keyId = request.params.id;
        const result = await (0, connection_1.query)(`UPDATE ankercloud.api_keys
       SET is_active = false
       WHERE id = $1 AND user_id = $2
       RETURNING id`, [keyId, userId]);
        if (result.rows.length === 0) {
            return reply.code(404).send({ error: 'API key not found' });
        }
        logger_1.logger.info(`API key revoked: ${keyId} by user ${userId}`);
        return reply.send({ message: 'API key revoked successfully' });
    });
    // ----------- Logout -----------
    fastify.post('/logout', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        const authRequest = request;
        const userId = authRequest.user.id;
        await (0, connection_1.query)(`INSERT INTO ankercloud.audit_logs (user_id, action, details)
       VALUES ($1, $2, $3)`, [userId, 'logout', JSON.stringify({ timestamp: new Date() })]);
        logger_1.logger.info(`User logged out: ${authRequest.user.email}`);
        return reply.send({ message: 'Logged out successfully' });
    });
};
exports.default = authRoutes;
//# sourceMappingURL=auth.js.map