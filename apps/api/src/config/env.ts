import { z } from 'zod';

/**
 * Validation des variables d'environnement au démarrage.
 * L'application refuse de démarrer si une variable obligatoire manque ou est
 * mal formée : mieux vaut un échec immédiat et lisible qu'une panne en vol.
 */

const nodeEnvSchema = z.enum(['development', 'test', 'production']);

const secret = (min = 32) => z.string().min(min, `Secret trop court : ${min} caractères minimum`);

const baseSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Origine publique du site, utilisée pour les liens des e-mails et la CSP. */
  APP_URL: z.string().url(),
  /** Origine publique de l'API. */
  API_URL: z.string().url(),
  /** Origines autorisées par CORS, séparées par des virgules. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: secret(32),
  /** Secret distinct pour les jetons de rafraîchissement : compromettre l'un ne donne pas l'autre. */
  REFRESH_SECRET: secret(32),
  CSRF_SECRET: secret(32),
  COOKIE_DOMAIN: z.string().optional(),

  /** Images. En développement, un stockage disque local prend le relais. */
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  /** E-mails transactionnels. Sans clé, le transport « console » est utilisé. */
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('Inbox <contact@inbox.cm>'),
  MAIL_REPLY_TO: z.string().optional(),

  /**
   * Fournisseurs de paiement. `MOCK` fournit un espace de paiement de
   * démonstration tant qu'aucun compte Maviance ni Stripe n'est ouvert ;
   * il est interdit en production (voir le raffinement plus bas).
   */
  PAYMENT_PROVIDER_MOBILE: z.enum(['MOCK', 'MAVIANCE']).default('MOCK'),
  PAYMENT_PROVIDER_CARD: z.enum(['MOCK', 'STRIPE']).default('MOCK'),

  MAVIANCE_BASE_URL: z.string().url().optional(),
  MAVIANCE_PUBLIC_TOKEN: z.string().optional(),
  MAVIANCE_SECRET_KEY: z.string().optional(),
  MAVIANCE_MERCHANT_ID: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  /** Mesure d'audience sans cookie, auto-hébergée. */
  UMAMI_SCRIPT_URL: z.string().url().optional(),
  UMAMI_WEBSITE_ID: z.string().optional(),

  /**
   * Identité de l'éditeur. Elle alimente les mentions légales, les CGU, les
   * CGV et les reçus, et n'est écrite en dur nulle part : le jour où la SARL
   * est immatriculée, ces variables changent et une nouvelle version des
   * documents est publiée.
   */
  PUBLISHER_KIND: z.enum(['INDIVIDUAL', 'COMPANY']).default('INDIVIDUAL'),
  PUBLISHER_NAME: z.string().min(2),
  PUBLISHER_LEGAL_FORM: z.string().optional(),
  PUBLISHER_CAPITAL: z.string().optional(),
  PUBLISHER_RCCM: z.string().optional(),
  PUBLISHER_NIU: z.string().optional(),
  PUBLISHER_ADDRESS: z.string().min(5),
  PUBLISHER_EMAIL: z.string().email(),
  PUBLISHER_PHONE: z.string().optional(),
  PUBLICATION_DIRECTOR: z.string().min(2),
  PRIVACY_CONTACT_EMAIL: z.string().email(),
  ABUSE_CONTACT_EMAIL: z.string().email(),
  DPO_NAME: z.string().optional(),
  DPO_EMAIL: z.string().email().optional(),

  /** Hébergeur, mention obligatoire. */
  HOST_NAME: z.string().min(2),
  HOST_ADDRESS: z.string().min(5),
  HOST_COUNTRY: z.string().min(2),
  HOST_WEBSITE: z.string().url().optional(),
});

const envSchema = baseSchema
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    const requireInProd = (key: keyof typeof env, why: string) => {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} est obligatoire en production (${why})`,
        });
      }
    };

    if (env.PAYMENT_PROVIDER_MOBILE === 'MOCK' || env.PAYMENT_PROVIDER_CARD === 'MOCK') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYMENT_PROVIDER_MOBILE'],
        message:
          'Le fournisseur de paiement de démonstration (MOCK) est interdit en production : ' +
          'configurer MAVIANCE et/ou STRIPE avant la mise en ligne.',
      });
    }

    if (env.PAYMENT_PROVIDER_MOBILE === 'MAVIANCE') {
      requireInProd('MAVIANCE_BASE_URL', 'appels Mobile Money');
      requireInProd('MAVIANCE_PUBLIC_TOKEN', 'appels Mobile Money');
      requireInProd('MAVIANCE_SECRET_KEY', 'signature des requêtes');
      requireInProd('MAVIANCE_MERCHANT_ID', 'identification du marchand');
    }

    if (env.PAYMENT_PROVIDER_CARD === 'STRIPE') {
      requireInProd('STRIPE_SECRET_KEY', 'appels Stripe');
      requireInProd('STRIPE_WEBHOOK_SECRET', 'vérification de la signature des webhooks');
    }

    requireInProd('CLOUDINARY_CLOUD_NAME', 'hébergement des photos');
    requireInProd('CLOUDINARY_API_KEY', 'hébergement des photos');
    requireInProd('CLOUDINARY_API_SECRET', 'signature des téléversements');
    requireInProd('RESEND_API_KEY', 'envoi des e-mails de vérification');

    if (!env.APP_URL.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_URL'],
        message: 'APP_URL doit être en HTTPS en production (cookies Secure, HSTS)',
      });
    }

    const distinct = new Set([env.JWT_SECRET, env.REFRESH_SECRET, env.CSRF_SECRET]);
    if (distinct.size !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET, REFRESH_SECRET et CSRF_SECRET doivent être trois secrets différents',
      });
    }
  })
  .transform((env) => ({
    ...env,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    isDevelopment: env.NODE_ENV === 'development',
    corsOrigins: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : [env.APP_URL],
  }));

export type Env = z.infer<typeof envSchema>;

/**
 * Une variable présente mais vide (`MAVIANCE_BASE_URL=` dans un `.env`) veut
 * dire « non configurée », pas « chaîne vide ». Sans ce nettoyage, chaque
 * emplacement laissé vide dans `.env.example` ferait échouer la validation.
 */
function dropEmpty(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const cleaned: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' && value.trim() === '') continue;
    cleaned[key] = value;
  }
  return cleaned;
}

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(dropEmpty(source));

  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join('.') || '(racine)'} : ${i.message}`,
    );
    throw new Error(
      `Configuration invalide. Corrigez le fichier .env (voir .env.example) :\n${lines.join('\n')}`,
    );
  }

  return result.data;
}

let cached: Env | null = null;

/** Accès paresseux pour que l'import du module ne fasse pas tomber les tests. */
export function env(): Env {
  cached ??= parseEnv();
  return cached;
}

/** Réservé aux tests. */
export function resetEnvCache(): void {
  cached = null;
}
