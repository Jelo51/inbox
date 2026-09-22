import type { PrismaClient, UserRole } from '@prisma/client';
import request from 'supertest';
import type { Express } from 'express';
import { publishLegalDocuments, uniqueEmail, VALID_PASSWORD } from './fixtures.js';

export interface TestAccount {
  id: string;
  email: string;
  accessToken: string;
  csrfToken: string;
  cookies: string[];
}

/**
 * Crée un compte déjà vérifié : la plupart des parcours exigent une adresse
 * confirmée, et repasser par l'e-mail à chaque test n'apprendrait rien.
 */
export async function createVerifiedAccount(
  app: Express,
  prisma: PrismaClient,
  options: { role?: UserRole; phone?: string; displayName?: string } = {},
): Promise<TestAccount> {
  await publishLegalDocuments(prisma);

  const email = uniqueEmail();
  const versions = await request(app).get('/api/v1/auth/legal-versions');

  const registered = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email,
      password: VALID_PASSWORD,
      displayName: options.displayName ?? 'Vendeur Essai',
      isAdult: true,
      acceptedLegalVersions: (versions.body as { versions: Record<string, string> }).versions,
    });

  if (registered.status !== 201) {
    throw new Error(
      `inscription en échec : ${registered.status} ${JSON.stringify(registered.body)}`,
    );
  }

  const user = await prisma.user.update({
    where: { email },
    data: {
      emailVerifiedAt: new Date(),
      ...(options.role && { role: options.role }),
      ...(options.phone && { phone: options.phone }),
    },
  });

  // Le rôle et la vérification sont portés par le jeton : il faut le réémettre.
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: VALID_PASSWORD });

  const raw = login.headers['set-cookie'];
  return {
    id: user.id,
    email,
    accessToken: (login.body as { accessToken: string }).accessToken,
    csrfToken: (login.body as { csrfToken: string }).csrfToken,
    cookies: Array.isArray(raw) ? raw.map((c) => c.split(';')[0] ?? '') : [],
  };
}

/** Photo minimale valide, pour les téléversements de test. */
export async function testPhoto(): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp({ create: { width: 600, height: 400, channels: 3, background: '#FF6E14' } })
    .jpeg()
    .toBuffer();
}
