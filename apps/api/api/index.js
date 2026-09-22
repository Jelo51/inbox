/**
 * Point d'entrée serverless (Vercel, ou tout hébergeur compatible AWS Lambda).
 *
 * Il réutilise exactement la même application Express que le serveur
 * long-vivant : il n'existe pas de « version Vercel » du code métier. Deux
 * fonctionnalités sont volontairement absentes ici, faute de processus
 * persistant, et c'est documenté dans docs/deploiement/ :
 *
 *   - les tâches planifiées (expiration des annonces et des abonnements,
 *     purges de conservation) ne tournent pas ;
 *   - le serveur WebSocket n'est pas attaché ; la messagerie bascule sur son
 *     repli en interrogation périodique, déjà implémenté côté client.
 *
 * C'est acceptable pour une démonstration, pas pour la production.
 */
import { createApp } from '../dist/app.js';
import { parseEnv } from '../dist/config/env.js';
import { createLogger } from '../dist/lib/logger.js';
import { getPrisma } from '../dist/lib/prisma.js';

const env = parseEnv();
const logger = createLogger();
const prisma = getPrisma();

const app = createApp({ env, prisma, logger });

export default app;
