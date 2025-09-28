import { Pool } from 'pg';
export declare function connectDatabase(): Promise<Pool>;
export declare function getDatabase(): Promise<Pool>;
export declare function query(text: string, params?: any[]): Promise<import("pg").QueryResult<any>>;
export declare function transaction<T>(callback: (client: any) => Promise<T>): Promise<T>;
export declare function closeDatabase(): Promise<void>;
//# sourceMappingURL=connection.d.ts.map