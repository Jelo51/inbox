import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { UserRole } from '@inbox/shared';
import { HttpError } from '../lib/http-error.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { isSessionActive } from '../modules/auth/sessions.js';
import { now } from '../lib/clock.js';

function bearerToken(req: Request): string | null {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Authentification par jeton d'accès. La session est revérifiée en base :
 * un jeton d'accès reste cryptographiquement valide jusqu'à son expiration,
 * mais une session révoquée doit cesser d'ouvrir des portes immédiatement.
 */
export function requireAuth(prisma: PrismaClient): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    void (async () => {
      try {
        const token = bearerToken(req);
        if (!token) throw HttpError.unauthorized();

        const claims = await verifyAccessToken(token);

        if (!(await isSessionActive(prisma, claims.sessionId, now()))) {
          throw HttpError.unauthorized('SESSION_REVOKED', 'Session expirée ou révoquée');
        }

        req.auth = {
          userId: claims.userId,
          role: claims.role,
          emailVerified: claims.emailVerified,
        };
        next();
      } catch (err) {
        next(err);
      }
    })();
  };
}

/** Authentification facultative : renseigne `req.auth` si un jeton valide est fourni. */
export function optionalAuth(prisma: PrismaClient): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    void (async () => {
      const token = bearerToken(req);
      if (!token) return next();

      try {
        const claims = await verifyAccessToken(token);
        if (await isSessionActive(prisma, claims.sessionId, now())) {
          req.auth = {
            userId: claims.userId,
            role: claims.role,
            emailVerified: claims.emailVerified,
          };
        }
      } catch {
        // Jeton invalide sur une route publique : on continue en anonyme.
      }
      next();
    })();
  };
}

/**
 * La vérification de l'adresse e-mail conditionne la publication d'annonces et
 * l'envoi de messages. C'est la première barrière contre les comptes jetables.
 */
export const requireVerifiedEmail: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(HttpError.unauthorized());
  if (!req.auth.emailVerified) {
    return next(
      HttpError.forbidden(
        'EMAIL_NOT_VERIFIED',
        'Vérifiez votre adresse e-mail avant de publier ou d’écrire',
      ),
    );
  }
  next();
};

/** Contrôle de rôle, toujours côté serveur, sur chaque route concernée. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(HttpError.unauthorized());
    if (!roles.includes(req.auth.role)) return next(HttpError.forbidden());
    next();
  };
}
