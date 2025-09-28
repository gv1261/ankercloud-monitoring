"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = connectRedis;
exports.getRedis = getRedis;
exports.getPubClient = getPubClient;
exports.getSubClient = getSubClient;
exports.getCached = getCached;
exports.setCached = setCached;
exports.deleteCached = deleteCached;
exports.pushToQueue = pushToQueue;
exports.popFromQueue = popFromQueue;
exports.addToStream = addToStream;
exports.readFromStream = readFromStream;
exports.closeRedis = closeRedis;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../config");
const logger_1 = require("./logger");
let redis = null;
let pubClient = null;
let subClient = null;
async function connectRedis() {
    if (redis)
        return redis;
    try {
        redis = new ioredis_1.default(config_1.config.redis.url, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => Math.min(times * 50, 2000),
            reconnectOnError: (err) => err.message.includes('READONLY'),
        });
        redis.on('connect', () => logger_1.logger.info('Redis connected'));
        redis.on('error', (err) => logger_1.logger.error('Redis error:', err));
        redis.on('close', () => logger_1.logger.warn('Redis connection closed'));
        await redis.ping();
        return redis;
    }
    catch (error) {
        logger_1.logger.error('Failed to connect to Redis:', error);
        throw error;
    }
}
async function getRedis() {
    if (!redis)
        return connectRedis();
    return redis;
}
async function getPubClient() {
    if (!pubClient) {
        pubClient = new ioredis_1.default(config_1.config.redis.url);
        pubClient.on('error', (err) => logger_1.logger.error('Redis Pub client error:', err));
    }
    return pubClient;
}
async function getSubClient() {
    if (!subClient) {
        subClient = new ioredis_1.default(config_1.config.redis.url);
        subClient.on('error', (err) => logger_1.logger.error('Redis Sub client error:', err));
    }
    return subClient;
}
async function getCached(key) {
    const client = await getRedis();
    const value = await client.get(key);
    if (!value)
        return null;
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
}
async function setCached(key, value, ttlSeconds) {
    const client = await getRedis();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
        await client.setex(key, ttlSeconds, serialized);
    }
    else {
        await client.set(key, serialized);
    }
}
async function deleteCached(key) {
    const client = await getRedis();
    await client.del(key);
}
async function pushToQueue(queue, data) {
    const client = await getRedis();
    await client.rpush(queue, JSON.stringify(data));
}
async function popFromQueue(queue) {
    const client = await getRedis();
    const data = await client.lpop(queue);
    if (!data)
        return null;
    try {
        return JSON.parse(data);
    }
    catch {
        return data;
    }
}
// Stream helpers
async function addToStream(stream, data) {
    const client = await getRedis();
    if (!stream)
        throw new Error('Stream name is required');
    // Spread fields for xadd
    const fields = [];
    Object.entries(data).forEach(([key, value]) => {
        fields.push(key, value);
    });
    return client.xadd(stream, '*', ...fields);
}
async function readFromStream(stream, lastId = '0') {
    const client = await getRedis();
    const results = await client.xread('BLOCK', 1000, 'STREAMS', stream, lastId);
    if (!results || results.length === 0)
        return [];
    return results[0][1].map(([id, fields]) => {
        const data = { id };
        for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]] = fields[i + 1];
        }
        return data;
    });
}
async function closeRedis() {
    if (redis) {
        await redis.quit();
        redis = null;
    }
    if (pubClient) {
        await pubClient.quit();
        pubClient = null;
    }
    if (subClient) {
        await subClient.quit();
        subClient = null;
    }
    logger_1.logger.info('Redis connections closed');
}
//# sourceMappingURL=redis.js.map