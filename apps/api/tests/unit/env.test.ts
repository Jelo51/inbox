import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

const VALID = {
  NODE_ENV: 'production',
  APP_URL: 'https://inbox.cm',
  API_URL: 'https://api.inbox.cm',
  DATABASE_URL: 'postgresql://inbox:secret@db:5432/inbox',
  JWT_SECRET: 'a'.repeat(40),
  REFRESH_SECRET: 'b'.repeat(40),
  CSRF_SECRET: 'c'.repeat(40),
  PAYMENT_PROVIDER_MOBILE: 'MAVIANCE',
  PAYMENT_PROVIDER_CARD: 'STRIPE',
  MAVIANCE_BASE_URL: 'https://api.smobilpay.com',
  MAVIANCE_PUBLIC_TOKEN: 'token',
  MAVIANCE_SECRET_KEY: 'secret',
  MAVIANCE_MERCHANT_ID: 'merchant',
  STRIPE_SECRET_KEY: 'sk_live_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_x',
  CLOUDINARY_CLOUD_NAME: 'inbox',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
  RESEND_API_KEY: 're_x',
  PUBLISHER_NAME: 'Flavien Noponkoue',
  PUBLISHER_ADDRESS: '2 avenue Robert Schuman, 51100 Reims, France',
  PUBLISHER_EMAIL: 'contact@inbox.cm',
  PUBLICATION_DIRECTOR: 'Flavien Noponkoue',
  PRIVACY_CONTACT_EMAIL: 'donnees@inbox.cm',
  ABUSE_CONTACT_EMAIL: 'abus@inbox.cm',
  HOST_NAME: 'OVH SAS',
  HOST_ADDRESS: '2 rue Kellermann, 59100 Roubaix, France',
  HOST_COUNTRY: 'France',
} satisfies NodeJS.ProcessEnv;

describe('validation de la configuration', () => {
  it('accepte une configuration de production complète', () => {
    const env = parseEnv({ ...VALID });
    expect(env.isProduction).toBe(true);
    expect(env.corsOrigins).toEqual(['https://inbox.cm']);
  });

  it('refuse de démarrer si une variable obligatoire manque', () => {
    const { DATABASE_URL: _omis, ...sansBase } = VALID;
    expect(() => parseEnv(sansBase)).toThrow(/DATABASE_URL/);
  });

  it('refuse le fournisseur de paiement de démonstration en production', () => {
    expect(() => parseEnv({ ...VALID, PAYMENT_PROVIDER_CARD: 'MOCK' })).toThrow(/MOCK/);
    expect(() => parseEnv({ ...VALID, PAYMENT_PROVIDER_MOBILE: 'MOCK' })).toThrow(/MOCK/);
  });

  it('refuse un APP_URL en clair en production', () => {
    expect(() => parseEnv({ ...VALID, APP_URL: 'http://inbox.cm' })).toThrow(/HTTPS/);
  });

  it('refuse deux secrets identiques', () => {
    expect(() => parseEnv({ ...VALID, REFRESH_SECRET: VALID.JWT_SECRET })).toThrow(/différents/);
  });

  it('refuse un secret trop court', () => {
    expect(() => parseEnv({ ...VALID, JWT_SECRET: 'court' })).toThrow(/JWT_SECRET/);
  });

  it('exige les identifiants Maviance quand Maviance est choisi', () => {
    const { MAVIANCE_SECRET_KEY: _omis, ...sansCle } = VALID;
    expect(() => parseEnv(sansCle)).toThrow(/MAVIANCE_SECRET_KEY/);
  });

  it('tolère une configuration allégée en développement', () => {
    const env = parseEnv({
      NODE_ENV: 'development',
      APP_URL: 'http://localhost:3000',
      API_URL: 'http://localhost:3001',
      DATABASE_URL: 'postgresql://inbox@localhost:5432/inbox',
      JWT_SECRET: 'a'.repeat(40),
      REFRESH_SECRET: 'b'.repeat(40),
      CSRF_SECRET: 'c'.repeat(40),
      PUBLISHER_NAME: VALID.PUBLISHER_NAME,
      PUBLISHER_ADDRESS: VALID.PUBLISHER_ADDRESS,
      PUBLISHER_EMAIL: VALID.PUBLISHER_EMAIL,
      PUBLICATION_DIRECTOR: VALID.PUBLICATION_DIRECTOR,
      PRIVACY_CONTACT_EMAIL: VALID.PRIVACY_CONTACT_EMAIL,
      ABUSE_CONTACT_EMAIL: VALID.ABUSE_CONTACT_EMAIL,
      HOST_NAME: VALID.HOST_NAME,
      HOST_ADDRESS: VALID.HOST_ADDRESS,
      HOST_COUNTRY: VALID.HOST_COUNTRY,
    });
    expect(env.PAYMENT_PROVIDER_CARD).toBe('MOCK');
    expect(env.isDevelopment).toBe(true);
  });
});
