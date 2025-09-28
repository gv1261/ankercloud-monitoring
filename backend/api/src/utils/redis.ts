import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

let redis: Redis | null = null;
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

export async function connectRedis(): Promise<Redis> {
  if (redis) return redis;

  try {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      reconnectOnError: (err) => err.message.includes('READONLY'),
    });

    redis.on('connect', () => logger.info('Redis connected'));
    redis.on('error', (err) => logger.error('Redis error:', err));
    redis.on('close', () => logger.warn('Redis connection closed'));

    await redis.ping();
    return redis;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export async function getRedis(): Promise<Redis> {
  if (!redis) return connectRedis();
  return redis;
}

export async function getPubClient(): Promise<Redis> {
  if (!pubClient) {
    pubClient = new Redis(config.redis.url);
    pubClient.on('error', (err) => logger.error('Redis Pub client error:', err));
  }
  return pubClient;
}

export async function getSubClient(): Promise<Redis> {
  if (!subClient) {
    subClient = new Redis(config.redis.url);
    subClient.on('error', (err) => logger.error('Redis Sub client error:', err));
  }
  return subClient;
}

export async function getCached<T>(key: string): Promise<T | null> {
  const client = await getRedis();
  const value = await client.get(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const client = await getRedis();
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);

  if (ttlSeconds) {
    await client.setex(key, ttlSeconds, serialized);
  } else {
    await client.set(key, serialized);
  }
}

export async function deleteCached(key: string): Promise<void> {
  const client = await getRedis();
  await client.del(key);
}

export async function pushToQueue(queue: string, data: any): Promise<void> {
  const client = await getRedis();
  await client.rpush(queue, JSON.stringify(data));
}

export async function popFromQueue(queue: string): Promise<any | null> {
  const client = await getRedis();
  const data = await client.lpop(queue);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

// Stream helpers
export async function addToStream(
  stream: string,
  data: Record<string, string>
): Promise<string> {
  const client = await getRedis();
  if (!stream) throw new Error('Stream name is required');

  // Spread fields for xadd
  const fields: string[] = [];
  Object.entries(data).forEach(([key, value]) => {
    fields.push(key, value);
  });

  return client.xadd(stream, '*', ...fields);
}

export async function readFromStream(
  stream: string,
  lastId: string = '0'
): Promise<Array<Record<string, string> & { id: string }>> {
  const client = await getRedis();
  const results = await client.xread('BLOCK', 1000, 'STREAMS', stream, lastId);

  if (!results || results.length === 0) return [];

  return results[0][1].map(([id, fields]: [string, string[]]) => {
    const data: Record<string, string> & { id: string } = { id };
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = fields[i + 1];
    }
    return data;
  });
}

export async function closeRedis(): Promise<void> {
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
  logger.info('Redis connections closed');
}