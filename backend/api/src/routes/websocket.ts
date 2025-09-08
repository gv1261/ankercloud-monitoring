import { FastifyPluginAsync } from 'fastify';
import { getSubClient, readFromStream } from '../utils/redis';
import { logger } from '../utils/logger';

const websocketHandler: FastifyPluginAsync = async (fastify) => {
  fastify.get('/metrics', { websocket: true }, async (connection, req) => {
    const socket = connection.socket;

    // Authentication via query param or initial message
    let authenticated = false;
    let userId: string | null = null;
    let subscriptions: string[] = [];
    let streamReaders: Map<string, NodeJS.Timer> = new Map();

    socket.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'auth') {
          // Verify JWT token
          try {
            const decoded = fastify.jwt.verify(data.token);
            userId = decoded.id;
            authenticated = true;

            socket.send(JSON.stringify({
              type: 'auth',
              status: 'success',
              userId,
            }));

            logger.info(`WebSocket authenticated for user: ${userId}`);
          } catch (error) {
            socket.send(JSON.stringify({
              type: 'auth',
              status: 'error',
              message: 'Invalid token',
            }));
            socket.close();
          }
        } else if (!authenticated) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Not authenticated',
          }));
          socket.close();
        } else if (data.type === 'subscribe') {
          // Subscribe to resource metrics
          const { resourceId, resourceType } = data;
          const streamKey = `metrics:${resourceType}:${resourceId}`;

          if (!subscriptions.includes(streamKey)) {
            subscriptions.push(streamKey);

            // Start reading from stream
            const reader = setInterval(async () => {
              try {
                const messages = await readFromStream(streamKey, '$');

                for (const msg of messages) {
                  socket.send(JSON.stringify({
                    type: 'metric',
                    resourceId,
                    resourceType,
                    data: msg,
                  }));
                }
              } catch (error) {
                logger.error(`Stream read error for ${streamKey}:`, error);
              }
            }, 1000); // Poll every second

            streamReaders.set(streamKey, reader);

            socket.send(JSON.stringify({
              type: 'subscribed',
              resourceId,
              resourceType,
            }));

            logger.info(`User ${userId} subscribed to ${streamKey}`);
          }
        } else if (data.type === 'unsubscribe') {
          // Unsubscribe from resource metrics
          const { resourceId, resourceType } = data;
          const streamKey = `metrics:${resourceType}:${resourceId}`;

          const index = subscriptions.indexOf(streamKey);
          if (index > -1) {
            subscriptions.splice(index, 1);

            // Stop reading from stream
            const reader = streamReaders.get(streamKey);
            if (reader) {
              clearInterval(reader);
              streamReaders.delete(streamKey);
            }

            socket.send(JSON.stringify({
              type: 'unsubscribed',
              resourceId,
              resourceType,
            }));

            logger.info(`User ${userId} unsubscribed from ${streamKey}`);
          }
        } else if (data.type === 'ping') {
          socket.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString(),
          }));
        }
      } catch (error) {
        logger.error('WebSocket message error:', error);
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });

    socket.on('close', () => {
      // Clean up subscriptions
      for (const [streamKey, reader] of streamReaders) {
        clearInterval(reader);
      }
      streamReaders.clear();

      logger.info(`WebSocket closed for user: ${userId}`);
    });

    socket.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });

    // Send initial connection message
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Please authenticate',
    }));
  });

  // Alerts WebSocket endpoint
  fastify.get('/alerts', { websocket: true }, async (connection, req) => {
    const socket = connection.socket;
    let authenticated = false;
    let userId: string | null = null;
    let alertSubscription: any = null;

    socket.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'auth') {
          try {
            const decoded = fastify.jwt.verify(data.token);
            userId = decoded.id;
            authenticated = true;

            // Subscribe to user's alerts via Redis pub/sub
            const subClient = await getSubClient();
            alertSubscription = `alerts:${userId}`;

            await subClient.subscribe(alertSubscription);

            subClient.on('message', (channel, message) => {
              if (channel === alertSubscription) {
                socket.send(message);
              }
            });

            socket.send(JSON.stringify({
              type: 'auth',
              status: 'success',
              userId,
            }));

            logger.info(`Alert WebSocket authenticated for user: ${userId}`);
          } catch (error) {
            socket.send(JSON.stringify({
              type: 'auth',
              status: 'error',
              message: 'Invalid token',
            }));
            socket.close();
          }
        } else if (!authenticated) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Not authenticated',
          }));
          socket.close();
        } else if (data.type === 'ping') {
          socket.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString(),
          }));
        }
      } catch (error) {
        logger.error('Alert WebSocket message error:', error);
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });

    socket.on('close', async () => {
      if (alertSubscription) {
        const subClient = await getSubClient();
        await subClient.unsubscribe(alertSubscription);
      }

      logger.info(`Alert WebSocket closed for user: ${userId}`);
    });

    socket.on('error', (error) => {
      logger.error('Alert WebSocket error:', error);
    });

    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Please authenticate',
    }));
  });

  // System status WebSocket (for global dashboard)
  fastify.get('/status', { websocket: true }, async (connection, req) => {
    const socket = connection.socket;
    let authenticated = false;
    let statusInterval: NodeJS.Timer | null = null;

    socket.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === 'auth') {
          try {
            const decoded = fastify.jwt.verify(data.token);
            authenticated = true;

            // Start sending system status updates
            statusInterval = setInterval(async () => {
              // Get system stats (simplified for now)
              const stats = {
                type: 'status',
                timestamp: new Date().toISOString(),
                system: {
                  uptime: process.uptime(),
                  memory: process.memoryUsage(),
                  cpu: process.cpuUsage(),
                },
              };

              socket.send(JSON.stringify(stats));
            }, 5000); // Every 5 seconds

            socket.send(JSON.stringify({
              type: 'auth',
              status: 'success',
            }));
          } catch (error) {
            socket.send(JSON.stringify({
              type: 'auth',
              status: 'error',
              message: 'Invalid token',
            }));
            socket.close();
          }
        } else if (!authenticated) {
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Not authenticated',
          }));
          socket.close();
        }
      } catch (error) {
        logger.error('Status WebSocket message error:', error);
      }
    });

    socket.on('close', () => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
      logger.info('Status WebSocket closed');
    });

    socket.send(JSON.stringify({
      type: 'connected',
      message: 'Please authenticate',
    }));
  });
};

export default websocketHandler;
