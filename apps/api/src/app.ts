import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import type { PrismaClient } from '@prisma/client';
import { RATE_LIMITS, truncateIp } from '@inbox/shared';
import type { Env } from './config/env.js';
import type { Logger } from './lib/logger.js';
import { securityMiddleware } from './middleware/security.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { join } from 'node:path';
import { apiV1Router } from './routes.js';
import { MailService } from './modules/mail/service.js';
import { createImageStorage, type ImageStorage } from './modules/images/storage.js';

export interface AppDependencies {
  env: Env;
  prisma: PrismaClient;
  logger: Logger;
  /** Injectable pour que les tests observent les e-mails sans rien envoyer. */
  mail?: MailService;
  storage?: ImageStorage;
}

export function createApp({ env, prisma, logger, mail, storage }: AppDependencies): Express {
  const app = express();

  // Derrière Nginx : sans cela, req.ip vaut l'adresse du reverse proxy et la
  // limitation de débit s'applique à tout le monde d'un coup.
  app.set('trust proxy', env.isProduction ? 1 : false);
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      // Aucune IP complète dans les journaux.
      customProps: (req) => ({ ipPrefix: truncateIp(req.socket.remoteAddress) }),
      autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use(...securityMiddleware(env));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(cookieParser());

  const imageStorage = storage ?? createImageStorage(env, logger);

  // En développement, les photos sont servies depuis le disque : Cloudinary
  // n'est pas nécessaire pour lancer le projet. En production, la validation de
  // configuration impose Cloudinary et ce dossier reste vide.
  if (!env.isProduction) {
    app.use(
      '/media',
      express.static(join(process.cwd(), 'uploads'), {
        maxAge: '7d',
        index: false,
        dotfiles: 'deny',
      }),
    );
  }

  app.use('/api/v1', createRateLimiter('global', RATE_LIMITS.global));
  app.use('/api/v1', apiV1Router(prisma, mail ?? new MailService(env, logger), imageStorage));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
