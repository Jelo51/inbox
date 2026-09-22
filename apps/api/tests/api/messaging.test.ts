import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../helpers/app.js';
import { createVerifiedAccount, testPhoto, type TestAccount } from '../helpers/accounts.js';
import { deleteTestLegalDocuments, deleteTestUsers } from '../helpers/fixtures.js';
import { generateKeyPair, open, seal, type KeyPair } from '../helpers/crypto.js';

const { app, prisma } = buildTestApp();
const EMAIL_MARKER = '@essai-inbox.test';

/** Phrase repère : si elle apparaît côté serveur, la promesse est rompue. */
const SECRET = 'Rendez-vous demain a 15h devant la pharmacie de Bonapriso, j apporte 250000 FCFA';

let vendeur: TestAccount;
let acheteur: TestAccount;
let tiers: TestAccount;
let cleVendeur: KeyPair;
let cleAcheteur: KeyPair;
let listingId: string;

async function registerKey(account: TestAccount, pair: KeyPair) {
  const res = await request(app)
    .post('/api/v1/keys')
    .set('Authorization', `Bearer ${account.accessToken}`)
    .send({ publicKey: pair.publicKey, fingerprint: pair.fingerprint, deviceLabel: 'Test' });

  if (res.status !== 201) {
    throw new Error(`enregistrement de clé en échec : ${JSON.stringify(res.body)}`);
  }
}

async function publishListing(seller: TestAccount): Promise<string> {
  const photo = await testPhoto();
  const upload = await request(app)
    .post('/api/v1/images')
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .attach('file', photo, { filename: 'p.jpg', contentType: 'image/jpeg' });

  const created = await request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${seller.accessToken}`)
    .send({
      title: 'Vélo tout terrain 26 pouces à vendre',
      description:
        'VTT en bon état, freins révisés, pneus récents. Visible à Bonapriso en semaine.',
      price: 68000,
      categorySlug: 'loisirs',
      citySlug: 'douala',
      imageIds: [upload.body.image.id],
    });

  await prisma.listing.update({
    where: { id: created.body.listing.id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });

  return created.body.listing.id as string;
}

beforeAll(async () => {
  vendeur = await createVerifiedAccount(app, prisma, { displayName: 'Vendeur Velo' });
  acheteur = await createVerifiedAccount(app, prisma, { displayName: 'Acheteur Curieux' });
  tiers = await createVerifiedAccount(app, prisma, { displayName: 'Personne Tierce' });

  cleVendeur = generateKeyPair();
  cleAcheteur = generateKeyPair();

  await registerKey(vendeur, cleVendeur);
  await registerKey(acheteur, cleAcheteur);

  listingId = await publishListing(vendeur);
});

afterAll(async () => {
  await deleteTestUsers(prisma, EMAIL_MARKER);
  await deleteTestLegalDocuments(prisma);
  await prisma.$disconnect();
});

describe('gestion des clés', () => {
  it('refuse une empreinte qui ne correspond pas à la clé', async () => {
    const compte = await createVerifiedAccount(app, prisma);
    const paire = generateKeyPair();

    const res = await request(app)
      .post('/api/v1/keys')
      .set('Authorization', `Bearer ${compte.accessToken}`)
      .send({ publicKey: paire.publicKey, fingerprint: 'AAAA BBBB CCCC DDDD EEEE FFFF 0000 1111' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FINGERPRINT_MISMATCH');
  });

  it('ne stocke jamais de clé privée', async () => {
    const stockees = await prisma.publicKey.findMany({ where: { userId: acheteur.id } });
    expect(stockees).toHaveLength(1);

    const enBase = JSON.stringify(stockees);
    const cleePriveeBase64 = Buffer.from(cleAcheteur.secretKey).toString('base64');
    expect(enBase).not.toContain(cleePriveeBase64);
  });

  it('retire l’ancienne clé quand un appareil en enregistre une nouvelle', async () => {
    const compte = await createVerifiedAccount(app, prisma);
    const premiere = generateKeyPair();
    const seconde = generateKeyPair();

    await registerKey(compte, premiere);
    await registerKey(compte, seconde);

    const cles = await prisma.publicKey.findMany({ where: { userId: compte.id } });
    expect(cles).toHaveLength(2);
    // L'ancienne est conservée : sans elle, les messages déjà chiffrés avec
    // elle ne pourraient plus lui être rattachés.
    expect(cles.filter((c) => c.retiredAt === null)).toHaveLength(1);
  });

  it('expose l’empreinte du correspondant, pour vérification de vive voix', async () => {
    const res = await request(app)
      .get(`/api/v1/keys/${vendeur.id}`)
      .set('Authorization', `Bearer ${acheteur.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.key.fingerprint).toBe(cleVendeur.fingerprint);
    expect(res.body.key.fingerprint).toMatch(/^[0-9A-F]{4}( [0-9A-F]{4}){7}$/);
  });
});

describe('sauvegarde de la clé privée', () => {
  it('stocke un blob que le serveur ne peut pas ouvrir', async () => {
    const blobChiffre = Buffer.from('ceci-est-deja-chiffre-cote-client').toString('base64');

    const enregistrement = await request(app)
      .put('/api/v1/keys/backup')
      .set('Authorization', `Bearer ${acheteur.accessToken}`)
      .send({
        encryptedPrivateKey: blobChiffre,
        salt: 'sel-aleatoire',
        nonce: 'nonce-aleatoire',
        kdf: 'argon2id',
        kdfParams: { memoryKiB: 19456, iterations: 2, parallelism: 1 },
      });

    expect(enregistrement.status).toBe(200);

    const relecture = await request(app)
      .get('/api/v1/keys/backup/mine')
      .set('Authorization', `Bearer ${acheteur.accessToken}`);

    expect(relecture.body.backup.encryptedPrivateKey).toBe(blobChiffre);
    expect(relecture.body.backup.kdf).toBe('argon2id');
    // Aucune phrase secrète n'est stockée, ni aucun moyen de la retrouver.
    expect(JSON.stringify(relecture.body)).not.toMatch(/passphrase|phrase|password/i);
  });

  it('refuse des paramètres de dérivation trop faibles', async () => {
    const res = await request(app)
      .put('/api/v1/keys/backup')
      .set('Authorization', `Bearer ${acheteur.accessToken}`)
      .send({
        encryptedPrivateKey: 'x',
        salt: 's',
        nonce: 'n',
        kdf: 'argon2id',
        kdfParams: { memoryKiB: 64, iterations: 1, parallelism: 1 },
      });

    expect(res.status).toBe(400);
  });

  it('n’expose pas la sauvegarde d’un autre membre', async () => {
    const res = await request(app)
      .get('/api/v1/keys/backup/mine')
      .set('Authorization', `Bearer ${tiers.accessToken}`);

    expect(res.status).toBe(404);
  });
});

describe('le serveur ne peut pas lire les messages', () => {
  let conversationId: string;

  it('ouvre une conversation depuis une annonce', async () => {
    const res = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${acheteur.accessToken}`)
      .send({ listingId });

    expect(res.status).toBe(201);
    conversationId = res.body.conversation.id;
  });

  it('transmet un message que seul le destinataire peut ouvrir', async () => {
    const pourVendeur = seal(SECRET, cleVendeur.publicKey, cleAcheteur.secretKey);
    const pourMoi = seal(SECRET, cleAcheteur.publicKey, cleAcheteur.secretKey);

    const envoi = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${acheteur.accessToken}`)
      .send({
        conversationId,
        ciphertext: pourVendeur.ciphertext,
        nonce: pourVendeur.nonce,
        senderCiphertext: pourMoi.ciphertext,
        senderNonce: pourMoi.nonce,
      });

    expect(envoi.status).toBe(201);

    // Le vendeur récupère le chiffré et l'ouvre avec sa clé privée.
    const recu = await request(app)
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${vendeur.accessToken}`);

    expect(recu.body.items).toHaveLength(1);
    const message = recu.body.items[0];

    const dechiffre = open(
      { ciphertext: message.ciphertext, nonce: message.nonce },
      cleAcheteur.publicKey,
      cleVendeur.secretKey,
    );
    expect(dechiffre).toBe(SECRET);

    // L'expéditeur relit son propre message grâce à la copie qui lui est destinée.
    const parLExpediteur = open(
      { ciphertext: message.senderCiphertext, nonce: message.senderNonce },
      cleAcheteur.publicKey,
      cleAcheteur.secretKey,
    );
    expect(parLExpediteur).toBe(SECRET);
  });

  it('un tiers ne peut pas ouvrir le message, même avec le chiffré en main', async () => {
    const cleTiers = generateKeyPair();
    const message = await prisma.message.findFirstOrThrow({ where: { conversationId } });

    const tentative = open(
      { ciphertext: message.ciphertext, nonce: message.nonce },
      cleAcheteur.publicKey,
      cleTiers.secretKey,
    );

    expect(tentative).toBeNull();
  });

  it('aucun clair ne se trouve dans la ligne stockée en base', async () => {
    const message = await prisma.message.findFirstOrThrow({ where: { conversationId } });
    const enBase = JSON.stringify(message);

    expect(enBase).not.toContain(SECRET);
    expect(enBase).not.toContain('pharmacie');
    expect(enBase).not.toContain('Bonapriso');
    expect(enBase).not.toContain('250000');
  });

  it('aucun clair nulle part dans toutes les colonnes texte de la base', async () => {
    // Balayage large : si un développeur ajoute un jour un champ d'aperçu ou
    // un index de recherche sur les messages, ce test le verra.
    const colonnes = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND data_type IN ('text', 'character varying')
    `;

    const trouvailles: string[] = [];
    for (const { table_name, column_name } of colonnes) {
      const rows = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
        `SELECT count(*) AS total FROM "${table_name}" WHERE "${column_name}" LIKE $1`,
        '%pharmacie de Bonapriso%',
      );
      if (Number(rows[0]?.total ?? 0) > 0) trouvailles.push(`${table_name}.${column_name}`);
    }

    // `DisclosedMessage.plaintext` est la seule colonne du système autorisée à
    // contenir du clair, et seulement quand l'utilisateur a explicitement
    // accepté de transmettre la conversation à la modération. Si elle apparaît
    // ici, on vérifie que ce consentement existe bel et bien.
    for (const trouvaille of trouvailles) {
      expect(trouvaille).toBe('DisclosedMessage.plaintext');
    }

    const sansConsentement = await prisma.disclosedMessage.count({
      where: { report: { disclosureConsentAt: null } },
    });
    expect(sansConsentement).toBe(0);
  });

  it('la réponse de l’API ne contient jamais le clair', async () => {
    const res = await request(app)
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${vendeur.accessToken}`);

    expect(JSON.stringify(res.body)).not.toContain('pharmacie');
  });

  it('la liste des conversations n’affiche aucun aperçu du dernier message', async () => {
    const res = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${vendeur.accessToken}`);

    const conversation = res.body.items.find((c: { id: string }) => c.id === conversationId);
    expect(conversation).toBeDefined();
    expect(conversation.preview).toBeUndefined();
    expect(conversation.lastMessage).toBeUndefined();
    expect(conversation.unread).toBe(true);
  });
});

describe('contrôle d’accès aux conversations', () => {
  let conversationId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${acheteur.accessToken}`)
      .send({ listingId });
    conversationId = res.body.conversation.id;
  });

  it('répond 404 à un tiers, pour ne pas confirmer l’existence de la conversation', async () => {
    const fil = await request(app)
      .get(`/api/v1/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${tiers.accessToken}`);
    expect(fil.status).toBe(404);

    const messages = await request(app)
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${tiers.accessToken}`);
    expect(messages.status).toBe(404);
  });

  it('empêche un tiers d’écrire dans la conversation', async () => {
    const cleTiers = generateKeyPair();
    await registerKey(tiers, cleTiers);
    const boite = seal('intrusion', cleVendeur.publicKey, cleTiers.secretKey);

    const res = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${tiers.accessToken}`)
      .send({
        conversationId,
        ciphertext: boite.ciphertext,
        nonce: boite.nonce,
        senderCiphertext: boite.ciphertext,
        senderNonce: boite.nonce,
      });

    expect(res.status).toBe(404);
  });
});

describe('pas de démarchage à froid', () => {
  it('refuse d’ouvrir une conversation sans annonce', async () => {
    const res = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${acheteur.accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('refuse une conversation sur une annonce qui n’est plus en ligne', async () => {
    const retiree = await publishListing(vendeur);
    await prisma.listing.update({ where: { id: retiree }, data: { status: 'EXPIRED' } });

    const res = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${tiers.accessToken}`)
      .send({ listingId: retiree });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LISTING_NOT_AVAILABLE');
  });

  it('refuse qu’un vendeur ouvre une conversation sur sa propre annonce', async () => {
    const res = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${vendeur.accessToken}`)
      .send({ listingId });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OWN_LISTING');
  });
});

describe('blocage', () => {
  it('coupe la conversation dans les deux sens', async () => {
    const bloqueur = await createVerifiedAccount(app, prisma);
    const bloque = await createVerifiedAccount(app, prisma);
    const cleBloqueur = generateKeyPair();
    const cleBloque = generateKeyPair();
    await registerKey(bloqueur, cleBloqueur);
    await registerKey(bloque, cleBloque);

    const annonce = await publishListing(bloqueur);
    const conversation = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${bloque.accessToken}`)
      .send({ listingId: annonce });
    expect(conversation.status).toBe(201);

    await request(app)
      .post('/api/v1/blocks')
      .set('Authorization', `Bearer ${bloqueur.accessToken}`)
      .send({ userId: bloque.id });

    const boite = seal('bonjour', cleBloqueur.publicKey, cleBloque.secretKey);
    const tentative = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${bloque.accessToken}`)
      .send({
        conversationId: conversation.body.conversation.id,
        ciphertext: boite.ciphertext,
        nonce: boite.nonce,
        senderCiphertext: boite.ciphertext,
        senderNonce: boite.nonce,
      });

    expect(tentative.status).toBe(403);
    expect(tentative.body.error.code).toBe('BLOCKED');

    // Et dans l'autre sens : celui qui a bloqué ne peut pas non plus relancer.
    const retour = await request(app)
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${bloqueur.accessToken}`)
      .send({
        conversationId: conversation.body.conversation.id,
        ciphertext: boite.ciphertext,
        nonce: boite.nonce,
        senderCiphertext: boite.ciphertext,
        senderNonce: boite.nonce,
      });

    expect(retour.status).toBe(403);
  });

  it('refuse de se bloquer soi-même', async () => {
    const res = await request(app)
      .post('/api/v1/blocks')
      .set('Authorization', `Bearer ${acheteur.accessToken}`)
      .send({ userId: acheteur.id });

    expect(res.status).toBe(400);
  });
});

describe('signalement volontaire d’une conversation', () => {
  it('exige un accord explicite pour transmettre des messages déchiffrés', async () => {
    const sansAccord = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${acheteur.accessToken}`)
      .send({
        target: 'CONVERSATION',
        targetId: 'clx0000000000000000000a1',
        reason: 'SCAM',
        disclosedMessages: [
          {
            messageId: 'clx0000000000000000000b1',
            sentAt: new Date().toISOString(),
            fromMe: false,
            plaintext: 'Envoyez un acompte de 50000 FCFA maintenant',
          },
        ],
      });

    expect(sansAccord.status).toBe(400);
    expect(sansAccord.body.error.details.disclosureConsent[0]).toMatch(/accord explicite/);
  });

  it('accepte le signalement quand l’utilisateur a donné son accord', async () => {
    const conversation = await prisma.conversation.findFirstOrThrow({
      where: { buyerId: acheteur.id },
    });
    const message = await prisma.message.findFirstOrThrow({
      where: { conversationId: conversation.id },
    });

    const res = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${acheteur.accessToken}`)
      .send({
        target: 'CONVERSATION',
        targetId: conversation.id,
        reason: 'SCAM',
        comment: 'Demande un acompte avant toute rencontre',
        disclosureConsent: true,
        disclosedMessages: [
          {
            messageId: message.id,
            sentAt: message.createdAt.toISOString(),
            fromMe: true,
            plaintext: SECRET,
          },
        ],
      });

    expect(res.status).toBe(201);

    const signalement = await prisma.report.findUniqueOrThrow({
      where: { id: res.body.report.id },
      include: { disclosedMessages: true },
    });

    expect(signalement.disclosureConsentAt).not.toBeNull();
    expect(signalement.disclosedMessages).toHaveLength(1);
    // C'est le seul endroit du système où du texte de conversation existe en
    // clair, et il n'y arrive que par un acte délibéré de l'utilisateur.
    expect(signalement.disclosedMessages[0]?.plaintext).toBe(SECRET);
  });
});
