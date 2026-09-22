import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import type { Request } from 'express';

export interface RateLimitConfig {
  points: number;
  windowSeconds: number;
}

/**
 * Limitation de débit. La clé est l'utilisateur authentifié lorsqu'il y en a
 * un, l'adresse IP sinon — jamais les deux concaténés, sans quoi changer de
 * compte suffirait à contourner la limite.
 */
export function createRateLimiter(
  name: string,
  config: RateLimitConfig,
  options: { byUser?: boolean } = {},
): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.windowSeconds * 1000,
    limit: config.points,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const userId = options.byUser ? req.auth?.userId : undefined;
      return userId ? `u:${userId}` : ipKeyGenerator(req.ip ?? '');
    },
    // Désactivé pendant les tests : sinon les suites se bloquent mutuellement.
    skip: () => process.env.NODE_ENV === 'test',
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Trop de requêtes, réessayez dans quelques instants',
        details: { limiter: [name] },
      },
    },
  });
}
