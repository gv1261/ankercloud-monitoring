"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = require("dotenv");
// Load environment variables
(0, dotenv_1.config)();
exports.config = {
    server: {
        port: parseInt(process.env.PORT || '3001'),
        host: process.env.HOST || '0.0.0.0',
        env: process.env.NODE_ENV || 'development',
    },
    database: {
        url: process.env.DATABASE_URL || 'postgresql://localhost:5432/ankercloud_monitoring',
        poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
    },
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    api: {
        keyPrefix: process.env.API_KEY_PREFIX || 'ank_',
    },
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    },
    rateLimit: {
        max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        window: process.env.RATE_LIMIT_WINDOW || '1m',
    },
    email: {
        smtp: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            user: process.env.SMTP_USER || '',
            password: process.env.SMTP_PASSWORD || '',
            from: process.env.SMTP_FROM || 'AnkerCloud Monitoring <alerts@ankercloud.com>',
        },
    },
    webhook: {
        timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '10000'),
        retryCount: parseInt(process.env.WEBHOOK_RETRY_COUNT || '3'),
    },
    monitoring: {
        defaultServerCheckInterval: parseInt(process.env.DEFAULT_SERVER_CHECK_INTERVAL || '30'),
        defaultWebsiteCheckInterval: parseInt(process.env.DEFAULT_WEBSITE_CHECK_INTERVAL || '300'),
        defaultNetworkCheckInterval: parseInt(process.env.DEFAULT_NETWORK_CHECK_INTERVAL || '60'),
    },
    retention: {
        rawDataDays: parseInt(process.env.RAW_DATA_RETENTION_DAYS || '7'),
        aggregatedDataDays: parseInt(process.env.AGGREGATED_DATA_RETENTION_DAYS || '90'),
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
};
// Validate required configuration
function validateConfig() {
    const required = [
        'DATABASE_URL',
        'JWT_SECRET',
    ];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.error(`Missing required environment variables: ${missing.join(', ')}`);
        if (exports.config.server.env === 'production') {
            process.exit(1);
        }
    }
}
validateConfig();
//# sourceMappingURL=config.js.map