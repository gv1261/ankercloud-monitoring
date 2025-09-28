"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("../utils/redis");
const logger_1 = require("../utils/logger");
const websocketHandler = async (fastify) => {
    fastify.get('/metrics', { websocket: true }, async (connection, _req) => {
        const socket = connection.socket;
        let authenticated = false;
        let userId = null;
        let subscriptions = [];
        let streamReaders = new Map();
        socket.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'auth') {
                    try {
                        const decoded = fastify.jwt.verify(data.token);
                        userId = decoded.id;
                        authenticated = true;
                        socket.send(JSON.stringify({
                            type: 'auth',
                            status: 'success',
                            userId,
                        }));
                        logger_1.logger.info(`WebSocket authenticated for user: ${userId}`);
                    }
                    catch (error) {
                        socket.send(JSON.stringify({
                            type: 'auth',
                            status: 'error',
                            message: 'Invalid token',
                        }));
                        socket.close();
                    }
                }
                else if (!authenticated) {
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: 'Not authenticated',
                    }));
                    socket.close();
                }
                else if (data.type === 'subscribe') {
                    const { resourceId, resourceType } = data;
                    const streamKey = `metrics:${resourceType}:${resourceId}`;
                    if (!subscriptions.includes(streamKey)) {
                        subscriptions.push(streamKey);
                        const reader = setInterval(async () => {
                            try {
                                const messages = await (0, redis_1.readFromStream)(streamKey, '$');
                                for (const msg of messages) {
                                    socket.send(JSON.stringify({
                                        type: 'metric',
                                        resourceId,
                                        resourceType,
                                        data: msg,
                                    }));
                                }
                            }
                            catch (error) {
                                logger_1.logger.error(`Stream read error for ${streamKey}:`, error);
                            }
                        }, 1000);
                        streamReaders.set(streamKey, reader);
                        socket.send(JSON.stringify({
                            type: 'subscribed',
                            resourceId,
                            resourceType,
                        }));
                        logger_1.logger.info(`User ${userId} subscribed to ${streamKey}`);
                    }
                }
                else if (data.type === 'unsubscribe') {
                    const { resourceId, resourceType } = data;
                    const streamKey = `metrics:${resourceType}:${resourceId}`;
                    const index = subscriptions.indexOf(streamKey);
                    if (index > -1) {
                        subscriptions.splice(index, 1);
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
                        logger_1.logger.info(`User ${userId} unsubscribed from ${streamKey}`);
                    }
                }
                else if (data.type === 'ping') {
                    socket.send(JSON.stringify({
                        type: 'pong',
                        timestamp: new Date().toISOString(),
                    }));
                }
            }
            catch (error) {
                logger_1.logger.error('WebSocket message error:', error);
                socket.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid message format',
                }));
            }
        });
        socket.on('close', () => {
            for (const [, reader] of streamReaders) {
                clearInterval(reader);
            }
            streamReaders.clear();
            logger_1.logger.info(`WebSocket closed for user: ${userId}`);
        });
        socket.on('error', (error) => {
            logger_1.logger.error('WebSocket error:', error);
        });
        socket.send(JSON.stringify({
            type: 'connected',
            message: 'Please authenticate',
        }));
    });
    fastify.get('/alerts', { websocket: true }, async (connection, _req) => {
        const socket = connection.socket;
        let authenticated = false;
        let userId = null;
        let alertSubscription = null;
        socket.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'auth') {
                    try {
                        const decoded = fastify.jwt.verify(data.token);
                        userId = decoded.id;
                        authenticated = true;
                        const subClient = await (0, redis_1.getSubClient)();
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
                        logger_1.logger.info(`Alert WebSocket authenticated for user: ${userId}`);
                    }
                    catch (error) {
                        socket.send(JSON.stringify({
                            type: 'auth',
                            status: 'error',
                            message: 'Invalid token',
                        }));
                        socket.close();
                    }
                }
                else if (!authenticated) {
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: 'Not authenticated',
                    }));
                    socket.close();
                }
                else if (data.type === 'ping') {
                    socket.send(JSON.stringify({
                        type: 'pong',
                        timestamp: new Date().toISOString(),
                    }));
                }
            }
            catch (error) {
                logger_1.logger.error('Alert WebSocket message error:', error);
                socket.send(JSON.stringify({
                    type: 'error',
                    message: 'Invalid message format',
                }));
            }
        });
        socket.on('close', async () => {
            if (alertSubscription) {
                const subClient = await (0, redis_1.getSubClient)();
                await subClient.unsubscribe(alertSubscription);
            }
            logger_1.logger.info(`Alert WebSocket closed for user: ${userId}`);
        });
        socket.on('error', (error) => {
            logger_1.logger.error('Alert WebSocket error:', error);
        });
        socket.send(JSON.stringify({
            type: 'connected',
            message: 'Please authenticate',
        }));
    });
    fastify.get('/status', { websocket: true }, async (connection, _req) => {
        const socket = connection.socket;
        let authenticated = false;
        let statusInterval = null;
        socket.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'auth') {
                    try {
                        fastify.jwt.verify(data.token);
                        authenticated = true;
                        statusInterval = setInterval(async () => {
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
                        }, 5000);
                        socket.send(JSON.stringify({
                            type: 'auth',
                            status: 'success',
                        }));
                    }
                    catch (error) {
                        socket.send(JSON.stringify({
                            type: 'auth',
                            status: 'error',
                            message: 'Invalid token',
                        }));
                        socket.close();
                    }
                }
                else if (!authenticated) {
                    socket.send(JSON.stringify({
                        type: 'error',
                        message: 'Not authenticated',
                    }));
                    socket.close();
                }
            }
            catch (error) {
                logger_1.logger.error('Status WebSocket message error:', error);
            }
        });
        socket.on('close', () => {
            if (statusInterval) {
                clearInterval(statusInterval);
            }
            logger_1.logger.info('Status WebSocket closed');
        });
        socket.send(JSON.stringify({
            type: 'connected',
            message: 'Please authenticate',
        }));
    });
};
exports.default = websocketHandler;
//# sourceMappingURL=websocket.js.map