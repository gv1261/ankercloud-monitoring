import { FastifyPluginAsync } from 'fastify';
export interface JwtPayload {
    id: string;
    email?: string;
    role?: string;
}
export interface AuthRequest {
    user?: {
        id: string;
        email: string;
    };
}
declare const authRoutes: FastifyPluginAsync;
export default authRoutes;
//# sourceMappingURL=auth.d.ts.map