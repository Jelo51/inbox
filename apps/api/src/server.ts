import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { disconnectPrisma, getPrisma } from './lib/prisma.js';
import { startScheduler } from './jobs/scheduler.js';
// L'import enregistre les tâches planifiées auprès de l'ordonnanceur.
import './jobs/listings.js';

async function main(): Promise<void> {
  // parseEnv lève une erreur explicite si la configuration est incomplète :
  // l'application refuse de démarrer plutôt que de tomber en panne plus tard.
  const env = parseEnv();
  const logger = createLogger();
  const prisma = getPrisma();

  const app = createApp({ env, prisma, logger });
  const stopScheduler = startScheduler({ prisma, logger });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API Inbox démarrée');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'arrêt en cours');
    stopScheduler();
    server.close(() => {
      void disconnectPrisma().finally(() => process.exit(0));
    });
    // Filet de sécurité si une connexion refuse de se fermer.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
