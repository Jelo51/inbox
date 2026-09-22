import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/app.js';
import { createVerifiedAccount, testPhoto, type TestAccount } from '../helpers/accounts.js';
import { deleteTestLegalDocuments, deleteTestUsers, VALID_PASSWORD } from '../helpers/fixtures.js';
import { generateKeyPair, seal, type KeyPair } from '../helpers/crypto.js';

const { app, prisma } = buildTestApp();
const EMAIL_MARKER = '@essai-inbox.test';

/** Phrase repère : elle ne doit plus exister nulle part après suppression. */
const SECRET = 'Rendez-vous au marche de Mokolo, j apporte 120000 FCFA en especes';

let vendeur: TestAccount;
let acheteur: TestAccount;
let cleVendeur: KeyPair;
let cleAcheteur: KeyPair;
let listingId: string;

async function registerKey(account: TestAccount, pair: KeyPair) {
  await request(app)
    .post('/api/v1/keys')
    .set('Authorization', `Bearer ${account.accessToken}`)
    .send({ publicKey: pair.publicKey, fingerprint: pair.fingerprint, deviceLabel: 'Test' });
}

async function publishListing(seller: TestAccount): Promise<string> {
  const upload = await request(app)
    .post('/api/v1/images')
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .attach('file', await testPhoto(), { filename: 'p.jpg', contentType: 'image/jpeg' });

  const created = await request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .send({
      title: 'Réfrigérateur combiné 240 litres',
      description:
        'Réfrigérateur en bon état de marche, joint de porte neuf, visible à Yaoundé en semaine.',
      price: 145000,
      categorySlug: 'maison',
      citySlug: 'yaounde',
      imageIds: [upload.body.image.id],
    });

  await prisma.listing.update({
    where: { id: created.body.listing.id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });

  return created.body.listing.id as string;
}

beforeAll(async () => {
  vendeur = await createVerifiedAccount(app, prisma, { displayName: 'Vendeur Frigo' });
  acheteur = await createVerifiedAccount(app, prisma, { displayName: 'Acheteur Frigo' });

  cleVendeur = generateKeyPair();
  cleAcheteur = generateKeyPair();
  await registerKey(vendeur, cleVendeur);
  await registerKey(acheteur, cleAcheteur);

  listingId = await publishListing(vendeur);

  // Une conversation et un message, pour voir ce qu'il en reste dans l'export.
  const conversation = await request(app)
    .post('/api/v1/conversations')
    .set('Authorization', `Bearer ${acheteur.accessToken}`)
    .send({ listingId });

  const pourVendeur = seal(SECRET, cleVendeur.publicKey, cleAcheteur.secretKey);
  const pourMoi = seal(SECRET, cleAcheteur.publicKey, cleAcheteur.secretKey);

  await request(app)
    .post('/api/v1/messages')
    .set('Authorization', `Bearer ${acheteur.accessToken}`)
    .send({
      conversationId: conversation.body.conversation.id,
      ciphertext: pourVendeur.ciphertext,
      nonce: pourVendeur.nonce,
      senderCiphertext: pourMoi.ciphertext,
      senderNonce: pourMoi.nonce,
    });
});

afterAll(async () => {
  await deleteTestUsers(prisma, EMAIL_MARKER);
  await deleteTestLegalDocuments(prisma);
  await prisma.$disconnect();
});

describe('export des données', () => {
  it('exige une authentification', async () => {
    const res = await request(app).get('/api/v1/account/export');
    expect(res.status).toBe(401);
  });

  it('renvoie un fichier à enregistrer, pas une page', async () => {
    const res = await request(app)
      .get('/api/v1/account/export')
      .set('Authorization', `Bearer ${vendeur.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="inbox-donnees-/);
  });

  it('contient le compte, les annonces et les conversations', async () => {
    const res = await request(app)
      .get('/api/v1/account/export')
      .set('Authorization', `Bearer ${vendeur.accessToken}`);

    expect(res.body.compte.email).toBe(vendeur.email);
    expect(res.body.annonces).toHaveLength(1);
    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.lisezMoi).toBeDefined();
  });

  // L'export doit refléter le chiffrement, pas le contourner : le serveur ne
  // peut pas déchiffrer, et un export en clair signifierait qu'il le peut.
  it('exporte les messages chiffrés, jamais en clair', async () => {
    const res = await request(app)
      .get('/api/v1/account/export')
      .set('Authorization', `Bearer ${vendeur.accessToken}`);

    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    expect(res.body.messages[0].ciphertext).toBeDefined();
  });

  it('ne contient pas l’empreinte du mot de passe', async () => {
    const res = await request(app)
      .get('/api/v1/account/export')
      .set('Authorization', `Bearer ${vendeur.accessToken}`);

    expect(JSON.stringify(res.body)).not.toContain('$argon2');
  });
});

describe('suppression de compte', () => {
  it('refuse sans le bon mot de passe', async () => {
    const compte = await createVerifiedAccount(app, prisma);

    const res = await request(app)
      .post('/api/v1/account/delete')
      .set('Authorization', `Bearer ${compte.accessToken}`)
      .set('Cookie', compte.cookies)
      .set('X-CSRF-Token', compte.csrfToken)
      .send({ password: 'Mauvais-Mot-De-Passe-2026', confirmation: 'SUPPRIMER' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_PASSWORD');
  });

  it('refuse sans la confirmation écrite', async () => {
    const compte = await createVerifiedAccount(app, prisma);

    const res = await request(app)
      .post('/api/v1/account/delete')
      .set('Authorization', `Bearer ${compte.accessToken}`)
      .set('Cookie', compte.cookies)
      .set('X-CSRF-Token', compte.csrfToken)
      .send({ password: VALID_PASSWORD, confirmation: 'oui' });

    expect(res.status).toBe(400);
  });

  // Se retrouver sans aucun administrateur est la panne la plus facile à
  // provoquer, et la plus pénible à réparer.
  it('refuse à un administrateur de supprimer son propre compte', async () => {
    const compte = await createVerifiedAccount(app, prisma, { role: 'ADMIN' });

    const res = await request(app)
      .post('/api/v1/account/delete')
      .set('Authorization', `Bearer ${compte.accessToken}`)
      .set('Cookie', compte.cookies)
      .set('X-CSRF-Token', compte.csrfToken)
      .send({ password: VALID_PASSWORD, confirmation: 'SUPPRIMER' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ADMIN_SELF_DELETE');
  });

  it('anonymise le compte et efface ce qui identifie la personne', async () => {
    const compte = await createVerifiedAccount(app, prisma, { displayName: 'Compte Ephemere' });
    const cle = generateKeyPair();
    await registerKey(compte, cle);
    const annonce = await publishListing(compte);

    const res = await request(app)
      .post('/api/v1/account/delete')
      .set('Authorization', `Bearer ${compte.accessToken}`)
      .set('Cookie', compte.cookies)
      .set('X-CSRF-Token', compte.csrfToken)
      .send({ password: VALID_PASSWORD, confirmation: 'SUPPRIMER' });

    expect(res.status).toBe(200);

    const apres = await prisma.user.findUniqueOrThrow({ where: { id: compte.id } });
    expect(apres.status).toBe('DELETED');
    expect(apres.anonymizedAt).not.toBeNull();
    expect(apres.email).not.toBe(compte.email);
    expect(apres.displayName).toBe('Compte supprimé');
    expect(apres.phone).toBeNull();

    expect(await prisma.listing.findUnique({ where: { id: annonce } })).toBeNull();
    expect(await prisma.publicKey.count({ where: { userId: compte.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: compte.id } })).toBe(0);
  });

  it('ferme les sessions : l’ancien mot de passe ne rouvre rien', async () => {
    const compte = await createVerifiedAccount(app, prisma);

    await request(app)
      .post('/api/v1/account/delete')
      .set('Authorization', `Bearer ${compte.accessToken}`)
      .set('Cookie', compte.cookies)
      .set('X-CSRF-Token', compte.csrfToken)
      .send({ password: VALID_PASSWORD, confirmation: 'SUPPRIMER' });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: compte.email, password: VALID_PASSWORD });

    expect(login.status).toBe(401);
  });

  // `Report.authorId` est en SetNull : sans purge explicite, les signalements
  // survivraient, et avec eux le seul texte de conversation en clair du système.
  it('efface les signalements émis et les messages transmis en clair', async () => {
    const signaleur = await createVerifiedAccount(app, prisma);

    const report = await prisma.report.create({
      data: {
        target: 'LISTING',
        targetId: listingId,
        authorId: signaleur.id,
        reason: 'SCAM',
        disclosureConsentAt: new Date(),
        disclosedMessages: {
          create: {
            originalMessageId: 'essai',
            sentAt: new Date(),
            fromReporter: true,
            plaintext: SECRET,
          },
        },
      },
    });

    await request(app)
      .post('/api/v1/account/delete')
      .set('Authorization', `Bearer ${signaleur.accessToken}`)
      .set('Cookie', signaleur.cookies)
      .set('X-CSRF-Token', signaleur.csrfToken)
      .send({ password: VALID_PASSWORD, confirmation: 'SUPPRIMER' });

    expect(await prisma.report.findUnique({ where: { id: report.id } })).toBeNull();
    expect(await prisma.disclosedMessage.count({ where: { reportId: report.id } })).toBe(0);
  });
});

describe('consentement aux traceurs', () => {
  it('indique qu’aucun consentement n’est requis tant qu’aucun traceur à cookie n’est configuré', async () => {
    const res = await request(app).get('/api/v1/consent');

    expect(res.status).toBe(200);
    expect(res.body.required).toBe(false);
  });

  it('enregistre un choix, et le refus autant que l’acceptation', async () => {
    const agent = request.agent(app);

    await agent.post('/api/v1/consent').send({ analytics: true, policyVersion: '1.0' });
    const refus = await agent
      .post('/api/v1/consent')
      .send({ analytics: false, policyVersion: '1.0' });

    expect(refus.status).toBe(200);
    expect(refus.body.consent.analytics).toBe(false);

    const etat = await agent.get('/api/v1/consent');
    expect(etat.body.consent.analytics).toBe(false);
  });
});
