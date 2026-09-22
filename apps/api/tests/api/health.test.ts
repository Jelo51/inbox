import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { createLogger } from '../../src/lib/logger.js';

const env = parseEnv();
const prisma = new PrismaClient();
const app = createApp({ env, prisma, logger: createLogger() });

afterAll(async () => {
  await prisma.$disconnect();
});

describe('ossature HTTP', () => {
  it('répond sur la sonde de disponibilité', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('renvoie une erreur de forme normalisée sur une route inconnue', async () => {
    const res = await request(app).get('/api/v1/inexistant');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('ne divulgue pas la technologie du serveur', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('pose une politique de sécurité du contenu sans tiers non déclaré', async () => {
    const res = await request(app).get('/api/v1/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // Les polices sont locales : aucune requête vers Google Fonts.
    expect(csp).not.toContain('fonts.googleapis.com');
    expect(csp).not.toContain('fonts.gstatic.com');
  });
});
