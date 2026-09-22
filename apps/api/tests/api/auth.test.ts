import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Response } from 'supertest';
import { buildTestApp } from '../helpers/app.js';
import {
  VALID_PASSWORD,
  deleteTestLegalDocuments,
  deleteTestUsers,
  publishLegalDocuments,
  uniqueEmail,
} from '../helpers/fixtures.js';

const { app, prisma, transport } = buildTestApp();

const EMAIL_MARKER = '@essai-inbox.test';

/** Rejoue le trio cookie de rafraîchissement + cookie CSRF + en-tête CSRF. */
function cookiesFrom(res: Response): string[] {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw.map((c) => c.split(';')[0] ?? '') : [];
}

function csrfFrom(res: Response): string {
  return (res.body as { csrfToken: string }).csrfToken;
}

async function registerUser(email = uniqueEmail()) {
  const versions = await request(app).get('/api/v1/auth/legal-versions');
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email,
      password: VALID_PASSWORD,
      displayName: 'Awa Nkolo',
      isAdult: true,
      acceptedLegalVersions: (versions.body as { versions: Record<string, string> }).versions,
    });
  return { res, email };
}

beforeAll(async () => {
  await publishLegalDocuments(prisma);
});

beforeEach(() => {
  transport.clear();
});

afterAll(async () => {
  await deleteTestUsers(prisma, EMAIL_MARKER);
  await deleteTestLegalDocuments(prisma);
  await prisma.$disconnect();
});

describe('inscription', () => {
  it('crée un compte, ouvre une session et envoie un e-mail de vérification', async () => {
    const { res, email } = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.emailVerified).toBe(false);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.expiresIn).toBe(900);

    // Le jeton de rafraîchissement ne transite jamais en JSON.
    expect(JSON.stringify(res.body)).not.toContain('refreshToken');
    expect(cookiesFrom(res).some((c) => c.startsWith('inbox_refresh='))).toBe(true);

    expect(transport.lastTo(email)).toBeDefined();
  });

  it('enregistre l’acceptation des CGU avec sa version et une IP tronquée', async () => {
    const { email } = await registerUser();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    const acceptances = await prisma.legalAcceptance.findMany({ where: { userId: user.id } });
    expect(acceptances).toHaveLength(2);
    expect(acceptances.map((a) => a.type).sort()).toEqual(['CGU', 'CONFIDENTIALITE']);
    for (const acceptance of acceptances) {
      expect(acceptance.version).toBe('1.0-test');
      // Jamais d'adresse complète : /24 pour IPv4, /48 pour IPv6.
      expect(acceptance.ipPrefix === null || /\.0$|::$/.test(acceptance.ipPrefix)).toBe(true);
    }
  });

  it('refuse une version de CGU périmée', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail(),
        password: VALID_PASSWORD,
        displayName: 'Test Perime',
        isAdult: true,
        acceptedLegalVersions: { CGU: '0.1', CONFIDENTIALITE: '0.1' },
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LEGAL_VERSION_OUTDATED');
  });

  it('exige la déclaration de majorité', async () => {
    const versions = await request(app).get('/api/v1/auth/legal-versions');
    const res = await request(app).post('/api/v1/auth/register').send({
      email: uniqueEmail(),
      password: VALID_PASSWORD,
      displayName: 'Trop Jeune',
      isAdult: false,
      acceptedLegalVersions: versions.body.versions,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details.isAdult[0]).toMatch(/18 ans/);
  });

  it('refuse un mot de passe trop court', async () => {
    const versions = await request(app).get('/api/v1/auth/legal-versions');
    const res = await request(app).post('/api/v1/auth/register').send({
      email: uniqueEmail(),
      password: 'court1A',
      displayName: 'Mot Court',
      isAdult: true,
      acceptedLegalVersions: versions.body.versions,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuse un numéro qui n’est pas un mobile camerounais', async () => {
    const versions = await request(app).get('/api/v1/auth/legal-versions');
    const res = await request(app).post('/api/v1/auth/register').send({
      email: uniqueEmail(),
      password: VALID_PASSWORD,
      displayName: 'Mauvais Numero',
      phone: '+33 6 12 34 56 78',
      isAdult: true,
      acceptedLegalVersions: versions.body.versions,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details.phone[0]).toMatch(/camerounais/);
  });

  it('ne stocke jamais le mot de passe en clair', async () => {
    const { email } = await registerUser();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    expect(user.passwordHash).not.toContain(VALID_PASSWORD);
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
  });
});

describe('vérification de l’adresse e-mail', () => {
  it('valide le compte avec le jeton reçu par e-mail', async () => {
    const { email } = await registerUser();
    const token = transport.tokenFor(email);

    const res = await request(app).post('/api/v1/auth/verify-email').send({ token });
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(true);
  });

  it('refuse un jeton déjà utilisé', async () => {
    const { email } = await registerUser();
    const token = transport.tokenFor(email);

    await request(app).post('/api/v1/auth/verify-email').send({ token });
    const second = await request(app).post('/api/v1/auth/verify-email').send({ token });

    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('INVALID_TOKEN');
  });

  it('ne stocke que l’empreinte du jeton, jamais le jeton lui-même', async () => {
    const { email } = await registerUser();
    const token = transport.tokenFor(email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    const stored = await prisma.emailToken.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).not.toBe(token);
    expect(stored[0]?.tokenHash).toHaveLength(64);
  });
});

describe('connexion', () => {
  it('ouvre une session avec les bons identifiants', async () => {
    const { email } = await registerUser();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: VALID_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  it('répond la même chose pour un compte inconnu et un mot de passe faux', async () => {
    const { email } = await registerUser();

    const mauvaisMotDePasse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Mauvais-Mot-De-Passe-2026' });
    const compteInconnu = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail('inconnu'), password: VALID_PASSWORD });

    expect(mauvaisMotDePasse.status).toBe(401);
    expect(compteInconnu.status).toBe(401);
    expect(mauvaisMotDePasse.body).toEqual(compteInconnu.body);
  });

  it('refuse un compte banni en le disant', async () => {
    const { email } = await registerUser();
    await prisma.user.update({
      where: { email },
      data: { status: 'BANNED', bannedAt: new Date() },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: VALID_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_BANNED');
  });

  it('refuse un compte suspendu jusqu’à la fin de la suspension', async () => {
    const { email } = await registerUser();
    await prisma.user.update({
      where: { email },
      data: {
        status: 'SUSPENDED',
        suspendedUntil: new Date(Date.now() + 86_400_000),
        suspendedFor: 'Test',
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: VALID_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('renouvellement de session', () => {
  it('fait tourner le jeton de rafraîchissement à chaque usage', async () => {
    const { res: registered } = await registerUser();
    const cookies = cookiesFrom(registered);
    const csrf = csrfFrom(registered);

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrf);

    expect(refreshed.status).toBe(200);

    const nouveauCookie = cookiesFrom(refreshed).find((c) => c.startsWith('inbox_refresh='));
    const ancienCookie = cookies.find((c) => c.startsWith('inbox_refresh='));
    expect(nouveauCookie).toBeDefined();
    expect(nouveauCookie).not.toBe(ancienCookie);
  });

  it('révoque toute la chaîne si un jeton déjà consommé est rejoué', async () => {
    const { res: registered, email } = await registerUser();
    const cookies = cookiesFrom(registered);
    const csrf = csrfFrom(registered);

    // Premier renouvellement : le jeton d'origine est consommé.
    const premier = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrf);
    expect(premier.status).toBe(200);

    // Rejeu du jeton d'origine : signature d'un vol.
    const rejeu = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrf);

    expect(rejeu.status).toBe(401);
    expect(rejeu.body.error.code).toBe('SESSION_REUSE');

    // Le jeton légitime émis entre-temps est mort lui aussi.
    const apres = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiesFrom(premier))
      .set('X-CSRF-Token', csrfFrom(premier));
    expect(apres.status).toBe(401);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const actives = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
    expect(actives).toBe(0);
  });

  it('refuse un renouvellement sans jeton anti-CSRF', async () => {
    const { res: registered } = await registerUser();

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiesFrom(registered));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('refuse un en-tête CSRF qui ne correspond pas au cookie', async () => {
    const { res: registered } = await registerUser();

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiesFrom(registered))
      .set('X-CSRF-Token', 'jeton-fabrique.signature-inventee');

    expect(res.status).toBe(403);
  });
});

describe('mot de passe oublié', () => {
  it('ne révèle pas si l’adresse est inscrite', async () => {
    const { email } = await registerUser();

    const connue = await request(app).post('/api/v1/auth/password/forgot').send({ email });
    const inconnue = await request(app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: uniqueEmail('jamais-vu') });

    expect(connue.status).toBe(200);
    expect(inconnue.status).toBe(200);
    expect(connue.body).toEqual(inconnue.body);
  });

  it('réinitialise le mot de passe et ferme toutes les sessions', async () => {
    const { res: registered, email } = await registerUser();
    transport.clear();

    await request(app).post('/api/v1/auth/password/forgot').send({ email });
    const token = transport.tokenFor(email);

    const nouveau = 'Nouveau-Motdepasse-2026';
    const reset = await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ token, password: nouveau });
    expect(reset.status).toBe(200);

    // L'ancien mot de passe ne fonctionne plus.
    const ancien = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: VALID_PASSWORD });
    expect(ancien.status).toBe(401);

    const avecNouveau = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: nouveau });
    expect(avecNouveau.status).toBe(200);

    // La session ouverte avant la réinitialisation est morte.
    const ancienneSession = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookiesFrom(registered))
      .set('X-CSRF-Token', csrfFrom(registered));
    expect(ancienneSession.status).toBe(401);
  });

  it('refuse un jeton de réinitialisation expiré', async () => {
    const { email } = await registerUser();
    transport.clear();

    await request(app).post('/api/v1/auth/password/forgot').send({ email });
    const token = transport.tokenFor(email);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.emailToken.updateMany({
      where: { userId: user.id, purpose: 'PASSWORD_RESET' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ token, password: 'Autre-Motdepasse-2026' });
    expect(res.status).toBe(400);
  });
});

describe('contrôle d’accès', () => {
  it('refuse /auth/me sans jeton', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('accepte /auth/me avec un jeton valide', async () => {
    const { res: registered, email } = await registerUser();

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registered.body.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it('rejette immédiatement un jeton d’accès dont la session a été révoquée', async () => {
    const { res: registered } = await registerUser();
    const accessToken = registered.body.accessToken as string;

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookiesFrom(registered))
      .set('X-CSRF-Token', csrfFrom(registered));

    // Le jeton reste cryptographiquement valide, mais la session n'existe plus.
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('SESSION_REVOKED');
  });

  it('refuse un jeton d’accès forgé', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.signature-inventee');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('changement d’adresse e-mail', () => {
  it('envoie la confirmation sur la nouvelle adresse, pas sur l’ancienne', async () => {
    const { res: registered, email } = await registerUser();
    const nouvelleAdresse = uniqueEmail('nouvelle');
    transport.clear();

    const demande = await request(app)
      .post('/api/v1/auth/email/change')
      .set('Authorization', `Bearer ${registered.body.accessToken}`)
      .send({ newEmail: nouvelleAdresse, currentPassword: VALID_PASSWORD });

    expect(demande.status).toBe(200);
    expect(transport.lastTo(nouvelleAdresse)).toBeDefined();
    expect(transport.lastTo(email)).toBeUndefined();

    const confirmation = await request(app)
      .post('/api/v1/auth/email/confirm')
      .send({ token: transport.tokenFor(nouvelleAdresse) });

    expect(confirmation.status).toBe(200);
    expect(confirmation.body.user.email).toBe(nouvelleAdresse);
  });

  it('exige le mot de passe courant', async () => {
    const { res: registered } = await registerUser();

    const res = await request(app)
      .post('/api/v1/auth/email/change')
      .set('Authorization', `Bearer ${registered.body.accessToken}`)
      .send({ newEmail: uniqueEmail('autre'), currentPassword: 'Mauvais-Mot-De-Passe-2026' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PASSWORD');
  });
});

describe('réacceptation après une nouvelle version des CGU', () => {
  it('signale la réacceptation à la connexion, puis l’enregistre', async () => {
    const { email } = await registerUser();

    // Publication d'une version postérieure : l'utilisateur doit la réaccepter.
    await publishLegalDocuments(prisma, '2.0-test');

    const connexion = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: VALID_PASSWORD });

    expect(connexion.status).toBe(200);
    expect(connexion.body.pendingLegalAcceptances).toHaveLength(2);
    expect(connexion.body.pendingLegalAcceptances[0].version).toBe('2.0-test');

    const acceptation = await request(app)
      .post('/api/v1/auth/legal/accept')
      .set('Authorization', `Bearer ${connexion.body.accessToken}`)
      .send({});
    expect(acceptation.status).toBe(200);

    const apres = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: VALID_PASSWORD });
    expect(apres.body.pendingLegalAcceptances).toEqual([]);

    // L'acceptation de la version précédente reste en base : on doit pouvoir
    // prouver ce qui a été accepté, et quand.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const acceptances = await prisma.legalAcceptance.findMany({ where: { userId: user.id } });
    expect(acceptances).toHaveLength(4);
    expect(new Set(acceptances.map((a) => a.version))).toEqual(new Set(['1.0-test', '2.0-test']));
  });
});
