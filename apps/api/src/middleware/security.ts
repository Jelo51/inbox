import cors from 'cors';
import helmet from 'helmet';
import type { RequestHandler } from 'express';
import type { Env } from '../config/env.js';

/**
 * Politique de sécurité du contenu. Les sources sont énumérées explicitement :
 * tout tiers non listé est bloqué par le navigateur, y compris avant tout
 * consentement (il n'y a de toute façon aucun traceur à cookie sur le site).
 */
export function contentSecurityPolicy(env: Env) {
  const cloudinary = env.CLOUDINARY_CLOUD_NAME ? ['https://res.cloudinary.com'] : [];
  const umami = env.UMAMI_SCRIPT_URL ? [new URL(env.UMAMI_SCRIPT_URL).origin] : [];
  const stripe = env.PAYMENT_PROVIDER_CARD === 'STRIPE' ? ['https://js.stripe.com'] : [];
  const stripeFrame =
    env.PAYMENT_PROVIDER_CARD === 'STRIPE'
      ? ['https://js.stripe.com', 'https://hooks.stripe.com']
      : [];
  const stripeApi = env.PAYMENT_PROVIDER_CARD === 'STRIPE' ? ['https://api.stripe.com'] : [];
  const maviance =
    env.PAYMENT_PROVIDER_MOBILE === 'MAVIANCE' && env.MAVIANCE_BASE_URL
      ? [new URL(env.MAVIANCE_BASE_URL).origin]
      : [];

  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'", ...umami, ...stripe],
    // Les polices sont servies localement (@fontsource) : aucun appel à Google Fonts.
    fontSrc: ["'self'", 'data:'],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:', ...cloudinary],
    connectSrc: ["'self'", env.API_URL, ...umami, ...stripeApi, ...maviance],
    frameSrc: [...stripeFrame],
    upgradeInsecureRequests: env.isProduction ? [] : null,
  };
}

export function securityMiddleware(env: Env): RequestHandler[] {
  const csp = contentSecurityPolicy(env);

  return [
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: Object.fromEntries(Object.entries(csp).filter(([, v]) => v !== null)) as Record<
          string,
          string[]
        >,
      },
      hsts: env.isProduction
        ? { maxAge: 63_072_000, includeSubDomains: true, preload: true }
        : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
    }),
    cors({
      origin(origin, callback) {
        // Requêtes sans origine (curl, applications natives) : pas de cookie en jeu.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origine non autorisée : ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      maxAge: 600,
    }),
  ];
}
