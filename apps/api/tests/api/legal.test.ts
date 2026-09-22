import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/app.js';
import { createVerifiedAccount, type TestAccount } from '../helpers/accounts.js';
import { deleteTestLegalDocuments, deleteTestUsers } from '../helpers/fixtures.js';

const { app, prisma } = buildTestApp();
const EMAIL_MARKER = '@essai-inbox.test';

let admin: TestAccount;
let membre: TestAccount;

beforeAll(async () => {
  admin = await createVerifiedAccount(app, prisma, { role: 'ADMIN' });
  membre = await createVerifiedAccount(app, prisma);
});

afterAll(async () => {
  // Le format de version imposé (`1.0`) ne laisse pas de place à un suffixe de
  // test : les versions créées ici se nettoient donc nommément.
  await prisma.legalDocument.deleteMany({
    where: { type: 'COOKIES', locale: 'fr', version: { in: ['9.0', '9.1'] } },
  });
  await deleteTestLegalDocuments(prisma);
  await deleteTestUsers(prisma, EMAIL_MARKER);
  await prisma.$disconnect();
});

describe('lecture publique des documents', () => {
  it('sert un document par son slug', async () => {
    const res = await request(app).get('/api/v1/legal/conditions-generales');

    expect(res.status).toBe(200);
    expect(res.body.document.type).toBe('CGU');
    expect(res.body.document.slug).toBe('conditions-generales');
  });

  it('accepte aussi le nom d’énumération, pour le back-office', async () => {
    const res = await request(app).get('/api/v1/legal/CGU');

    expect(res.status).toBe(200);
    expect(res.body.document.type).toBe('CGU');
  });

  it('remplace les marqueurs d’identité au rendu', async () => {
    const res = await request(app).get('/api/v1/legal/mentions-legales');

    expect(res.status).toBe(200);
    expect(res.body.document.body).not.toMatch(/\{\{/);
    expect(res.body.document.body).toContain(process.env.PUBLISHER_NAME);
  });

  it('répond 404 sur un document inconnu, pas 500', async () => {
    const res = await request(app).get('/api/v1/legal/inexistant');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('UNKNOWN_DOCUMENT');
  });

  it('expose l’historique des versions', async () => {
    const res = await request(app).get('/api/v1/legal/confidentialite/versions');

    expect(res.status).toBe(200);
    expect(res.body.versions.length).toBeGreaterThan(0);
  });

  it('expose l’identité de l’éditeur et de l’hébergeur', async () => {
    const res = await request(app).get('/api/v1/legal');

    expect(res.status).toBe(200);
    expect(res.body.publisher.email).toBe(process.env.PUBLISHER_EMAIL);
    expect(res.body.host.name).toBe(process.env.HOST_NAME);
    // Rien de plus que ce que les mentions légales affichent déjà.
    expect(res.body.publisher).not.toHaveProperty('capital');
  });
});

describe('inscription et documents légaux', () => {
  it('l’inscription est possible dès lors que les documents sont publiés', async () => {
    const res = await request(app).get('/api/v1/auth/legal-versions');

    expect(res.status).toBe(200);
    expect(res.body.versions.CGU).toBeDefined();
    expect(res.body.versions.CONFIDENTIALITE).toBeDefined();
  });
});

describe('publication depuis le back-office', () => {
  const body = 'Texte de la nouvelle version, suffisamment long pour passer la validation.';

  it('refuse un membre ordinaire', async () => {
    const res = await request(app)
      .get('/api/v1/admin/legal')
      .set('Authorization', `Bearer ${membre.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('publie une nouvelle version et l’enregistre au journal d’audit', async () => {
    const res = await request(app)
      .post('/api/v1/admin/legal')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Cookie', admin.cookies)
      .send({
        type: 'COOKIES',
        locale: 'fr',
        version: '9.0',
        title: 'Politique cookies (essai)',
        body,
        effectiveAt: new Date(Date.now() - 1_000).toISOString(),
      });

    expect(res.status).toBe(201);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'LEGAL_DOCUMENT_PUBLISHED', targetId: res.body.document.id },
    });
    expect(audit).not.toBeNull();
  });

  it('sert désormais la nouvelle version', async () => {
    const res = await request(app).get('/api/v1/legal/cookies');

    expect(res.body.document.version).toBe('9.0');
  });

  // Un utilisateur a accepté une version identifiée : en réécrire le texte
  // ferait mentir la preuve d'acceptation.
  it('refuse de réécrire une version déjà publiée', async () => {
    const res = await request(app)
      .post('/api/v1/admin/legal')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Cookie', admin.cookies)
      .send({
        type: 'COOKIES',
        locale: 'fr',
        version: '9.0',
        title: 'Politique cookies (essai)',
        body: `${body} Et une phrase de plus.`,
        effectiveAt: new Date().toISOString(),
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VERSION_ALREADY_PUBLISHED');
  });

  it('refuse un corps contenant un marqueur sans valeur', async () => {
    const res = await request(app)
      .post('/api/v1/admin/legal')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Cookie', admin.cookies)
      .send({
        type: 'COOKIES',
        locale: 'fr',
        version: '9.1',
        title: 'Politique cookies (essai)',
        body: `${body} Marqueur : {{marqueur.inexistant}}`,
        effectiveAt: new Date().toISOString(),
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNRESOLVED_PLACEHOLDERS');
  });

  it('refuse un numéro de version mal formé', async () => {
    const res = await request(app)
      .post('/api/v1/admin/legal')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Cookie', admin.cookies)
      .send({
        type: 'COOKIES',
        locale: 'fr',
        version: 'brouillon',
        title: 'Politique cookies (essai)',
        body,
        effectiveAt: new Date().toISOString(),
      });

    expect(res.status).toBe(400);
  });
});
