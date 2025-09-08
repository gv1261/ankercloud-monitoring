import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export async function connectDatabase(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  try {
    pool = new Pool({
      connectionString: config.database.url,
      max: config.database.poolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('Database connection established');

    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('Unexpected database error:', err);
    });

    return pool;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

export async function getDatabase(): Promise<Pool> {
  if (!pool) {
    return connectDatabase();
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  const db = await getDatabase();
  const start = Date.now();

  try {
    const result = await db.query(text, params);
    const duration = Date.now() - start;

    logger.debug({
      query: text,
      duration,
      rows: result.rowCount,
    });

    return result;
  } catch (error) {
    logger.error({
      query: text,
      error,
    });
    throw error;
  }
}

export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const db = await getDatabase();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection closed');
  }
}
