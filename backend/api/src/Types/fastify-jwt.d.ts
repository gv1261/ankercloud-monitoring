declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; email?: string; role?: string };
    user: { id: string; email?: string; role?: string };
  }
}
