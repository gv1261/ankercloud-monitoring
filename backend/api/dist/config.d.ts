export declare const config: {
    server: {
        port: number;
        host: string;
        env: string;
    };
    database: {
        url: string;
        poolSize: number;
    };
    redis: {
        url: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    api: {
        keyPrefix: string;
    };
    cors: {
        origin: string[];
    };
    rateLimit: {
        max: number;
        window: string;
    };
    email: {
        smtp: {
            host: string;
            port: number;
            user: string;
            password: string;
            from: string;
        };
    };
    webhook: {
        timeout: number;
        retryCount: number;
    };
    monitoring: {
        defaultServerCheckInterval: number;
        defaultWebsiteCheckInterval: number;
        defaultNetworkCheckInterval: number;
    };
    retention: {
        rawDataDays: number;
        aggregatedDataDays: number;
    };
    logging: {
        level: string;
    };
};
//# sourceMappingURL=config.d.ts.map