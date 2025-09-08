import * as cron from 'node-cron';
import Queue from 'bull';
import { Pool } from 'pg';
import Redis from 'ioredis';
import pino from 'pino';
import { config } from 'dotenv';

// Load environment variables
config();

// Logger setup
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

// Database connection
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/ankercloud_monitoring',
});

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Create job queues
const websiteQueue = new Queue('website-checks', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

const networkQueue = new Queue('network-checks', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

// Schedule types
interface WebsiteCheck {
  resourceId: string;
  url: string;
  method: string;
  expectedStatusCode: number;
  timeoutSeconds: number;
  headers: Record<string, string>;
  sslCheck: boolean;
  keywordCheck?: string;
}

interface NetworkCheck {
  resourceId: string;
  checkType: 'ping' | 'port' | 'traceroute';
  targetHost: string;
  targetPort?: number;
  timeoutSeconds: number;
}

// Main scheduler class
class MonitoringScheduler {
  private websiteJobs: Map<string, cron.ScheduledTask> = new Map();
  private networkJobs: Map<string, cron.ScheduledTask> = new Map();

  async start() {
    logger.info('Starting AnkerCloud Monitoring Scheduler');

    // Load and schedule all active checks
    await this.loadAndScheduleChecks();

    // Reload checks every 5 minutes to pick up changes
    cron.schedule('*/5 * * * *', async () => {
      logger.info('Reloading monitoring schedules');
      await this.loadAndScheduleChecks();
    });

    // Health check
    cron.schedule('* * * * *', () => {
      logger.debug('Scheduler heartbeat');
    });

    logger.info('Scheduler started successfully');
  }

  private async loadAndScheduleChecks() {
    try {
      // Load website checks
      const websiteChecks = await this.loadWebsiteChecks();
      this.scheduleWebsiteChecks(websiteChecks);

      // Load network checks
      const networkChecks = await this.loadNetworkChecks();
      this.scheduleNetworkChecks(networkChecks);

      logger.info(`Scheduled ${websiteChecks.length} website checks and ${networkChecks.length} network checks`);
    } catch (error) {
      logger.error('Failed to load checks:', error);
    }
  }

  private async loadWebsiteChecks(): Promise<WebsiteCheck[]> {
    const query = `
      SELECT
        r.id as resource_id,
        w.url,
        w.method,
        w.expected_status_code,
        w.timeout_seconds,
        w.check_interval_seconds,
        w.headers,
        w.ssl_check,
        w.keyword_check
      FROM ankercloud.resources r
      JOIN ankercloud.websites w ON r.id = w.resource_id
      WHERE r.is_active = true
    `;

    const result = await pgPool.query(query);

    return result.rows.map(row => ({
      resourceId: row.resource_id,
      url: row.url,
      method: row.method,
      expectedStatusCode: row.expected_status_code,
      timeoutSeconds: row.timeout_seconds,
      checkIntervalSeconds: row.check_interval_seconds,
      headers: row.headers || {},
      sslCheck: row.ssl_check,
      keywordCheck: row.keyword_check,
    }));
  }

  private async loadNetworkChecks(): Promise<NetworkCheck[]> {
    const query = `
      SELECT
        r.id as resource_id,
        n.check_type,
        n.target_host,
        n.target_port,
        n.check_interval_seconds,
        n.timeout_seconds
      FROM ankercloud.resources r
      JOIN ankercloud.network_checks n ON r.id = n.resource_id
      WHERE r.is_active = true
    `;

    const result = await pgPool.query(query);

    return result.rows.map(row => ({
      resourceId: row.resource_id,
      checkType: row.check_type,
      targetHost: row.target_host,
      targetPort: row.target_port,
      checkIntervalSeconds: row.check_interval_seconds,
      timeoutSeconds: row.timeout_seconds,
    }));
  }

  private scheduleWebsiteChecks(checks: WebsiteCheck[]) {
    // Clear existing jobs
    this.websiteJobs.forEach(job => job.stop());
    this.websiteJobs.clear();

    // Schedule new jobs
    checks.forEach(check => {
      const intervalSeconds = (check as any).checkIntervalSeconds || 300;
      const cronExpression = this.secondsToCron(intervalSeconds);

      const job = cron.schedule(cronExpression, async () => {
        await this.enqueueWebsiteCheck(check);
      });

      this.websiteJobs.set(check.resourceId, job);

      // Run immediately on startup
      this.enqueueWebsiteCheck(check);
    });
  }

  private scheduleNetworkChecks(checks: NetworkCheck[]) {
    // Clear existing jobs
    this.networkJobs.forEach(job => job.stop());
    this.networkJobs.clear();

    // Schedule new jobs
    checks.forEach(check => {
      const intervalSeconds = (check as any).checkIntervalSeconds || 60;
      const cronExpression = this.secondsToCron(intervalSeconds);

      const job = cron.schedule(cronExpression, async () => {
        await this.enqueueNetworkCheck(check);
      });

      this.networkJobs.set(check.resourceId, job);

      // Run immediately on startup
      this.enqueueNetworkCheck(check);
    });
  }

  private async enqueueWebsiteCheck(check: WebsiteCheck) {
    try {
      await websiteQueue.add('check-website', check, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      logger.debug(`Enqueued website check for ${check.url}`);
    } catch (error) {
      logger.error(`Failed to enqueue website check for ${check.url}:`, error);
    }
  }

  private async enqueueNetworkCheck(check: NetworkCheck) {
    try {
      await networkQueue.add('check-network', check, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });

      logger.debug(`Enqueued ${check.checkType} check for ${check.targetHost}`);
    } catch (error) {
      logger.error(`Failed to enqueue network check for ${check.targetHost}:`, error);
    }
  }

  private secondsToCron(seconds: number): string {
    if (seconds < 60) {
      return `*/${seconds} * * * * *`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `0 */${minutes} * * * *`;
    } else {
      const hours = Math.floor(seconds / 3600);
      return `0 0 */${hours} * * *`;
    }
  }

  async stop() {
    logger.info('Stopping scheduler');

    // Stop all cron jobs
    this.websiteJobs.forEach(job => job.stop());
    this.networkJobs.forEach(job => job.stop());

    // Close connections
    await pgPool.end();
    await redis.quit();
    await websiteQueue.close();
    await networkQueue.close();

    logger.info('Scheduler stopped');
  }
}

// Start the scheduler
const scheduler = new MonitoringScheduler();

scheduler.start().catch(error => {
  logger.error('Failed to start scheduler:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  await scheduler.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received');
  await scheduler.stop();
  process.exit(0);
});
