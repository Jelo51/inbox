import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

/**
 * Une seule instance par processus. En développement, `tsx watch` recharge le
 * module : sans ce cache global, chaque rechargement ouvrirait un nouveau pool.
 */
const globalForPrisma = globalThis as unknown as { __inboxPrisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  globalForPrisma.__inboxPrisma ??= new PrismaClient({
    log: env().isDevelopment ? ['warn', 'error'] : ['error'],
  });
  return globalForPrisma.__inboxPrisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.__inboxPrisma) {
    await globalForPrisma.__inboxPrisma.$disconnect();
    globalForPrisma.__inboxPrisma = undefined;
  }
}
