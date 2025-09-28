import Redis from 'ioredis';
export declare function connectRedis(): Promise<Redis>;
export declare function getRedis(): Promise<Redis>;
export declare function getPubClient(): Promise<Redis>;
export declare function getSubClient(): Promise<Redis>;
export declare function getCached<T>(key: string): Promise<T | null>;
export declare function setCached<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
export declare function deleteCached(key: string): Promise<void>;
export declare function pushToQueue(queue: string, data: any): Promise<void>;
export declare function popFromQueue(queue: string): Promise<any | null>;
export declare function addToStream(stream: string, data: Record<string, string>): Promise<string>;
export declare function readFromStream(stream: string, lastId?: string): Promise<Array<Record<string, string> & {
    id: string;
}>>;
export declare function closeRedis(): Promise<void>;
//# sourceMappingURL=redis.d.ts.map