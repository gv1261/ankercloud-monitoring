"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = connectDatabase;
exports.getDatabase = getDatabase;
exports.query = query;
exports.transaction = transaction;
exports.closeDatabase = closeDatabase;
const pg_1 = require("pg");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
let pool = null;
async function connectDatabase() {
    if (pool) {
        return pool;
    }
    try {
        pool = new pg_1.Pool({
            connectionString: config_1.config.database.url,
            max: config_1.config.database.poolSize,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        // Test connection
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        logger_1.logger.info('Database connection established');
        // Handle pool errors
        pool.on('error', (err) => {
            logger_1.logger.error('Unexpected database error:', err);
        });
        return pool;
    }
    catch (error) {
        logger_1.logger.error('Failed to connect to database:', error);
        throw error;
    }
}
async function getDatabase() {
    if (!pool) {
        return connectDatabase();
    }
    return pool;
}
async function query(text, params) {
    const db = await getDatabase();
    const start = Date.now();
    try {
        const result = await db.query(text, params);
        const duration = Date.now() - start;
        logger_1.logger.debug({
            query: text,
            duration,
            rows: result.rowCount,
        });
        return result;
    }
    catch (error) {
        logger_1.logger.error({
            query: text,
            error,
        });
        throw error;
    }
}
async function transaction(callback) {
    const db = await getDatabase();
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function closeDatabase() {
    if (pool) {
        await pool.end();
        pool = null;
        logger_1.logger.info('Database connection closed');
    }
}
//# sourceMappingURL=connection.js.map