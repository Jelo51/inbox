import nacl from 'tweetnacl';
import { argon2id } from '@noble/hashes/argon2.js';
import type { PrismaClient } from '@prisma/client';
import { addDays } from '@inbox/shared';
import { computeFingerprint } from '../../src/modules/messaging/fingerprint.js';
import type { SeedAccounts } from './users.js';

/**
 * Conversations de démonstration, chiffrées avec de vraies clés.
 *
 * Les clés privées ne sont pas stockées en base : elles sont sauvegardées
 * exactement comme celles d'un utilisateur réel, c'est-à-dire chiffrées par une
 * phrase secrète. La phrase est documentée dans le README de développement, ce
 * qui permet de dérouler le vrai parcours de restauration plutôt qu'un raccourci
 * qui ne prouverait rien.
 */
export const SEED_PASSPHRASE = 'phrase-secrete-de-demonstration-2026';

const KDF = { memoryKiB: 19456, iterations: 2, parallelism: 1 } as const;

const encoder = new TextEncoder();

function b64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

interface SeedKeyPair {
  publicKey: string;
  secretKey: Uint8Array;
  fingerprint: string;
}

function generate(): SeedKeyPair {
  const pair = nacl.box.keyPair();
  const publicKey = b64(pair.publicKey);
  return { publicKey, secretKey: pair.secretKey, fingerprint: computeFingerprint(publicKey) };
}

/** Sauvegarde chiffrée, au format exact attendu par le client. */
function buildBackup(pair: SeedKeyPair) {
  const salt = nacl.randomBytes(16);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const key = argon2id(encoder.encode(SEED_PASSPHRASE), salt, {
    m: KDF.memoryKiB,
    t: KDF.iterations,
    p: KDF.parallelism,
    dkLen: nacl.secretbox.keyLength,
  });

  return {
    encryptedPrivateKey: b64(nacl.secretbox(pair.secretKey, nonce, key)),
    salt: b64(salt),
    nonce: b64(nonce),
    kdf: 'argon2id',
    kdfParams: KDF,
  };
}

function seal(plaintext: string, recipientPublicKey: string, senderSecret: Uint8Array) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const boxed = nacl.box(
    encoder.encode(plaintext),
    nonce,
    Buffer.from(recipientPublicKey, 'base64'),
    senderSecret,
  );
  return { ciphertext: b64(boxed), nonce: b64(nonce) };
}

/** Échanges plausibles entre un acheteur et un vendeur. */
const EXCHANGES = [
  [
    { from: 'buyer', text: "Bonjour, l'article est-il toujours disponible ?" },
    { from: 'seller', text: 'Bonjour, oui il est disponible. Vous êtes sur Douala ?' },
    { from: 'buyer', text: 'Oui, à Akwa. Je peux passer le voir samedi matin ?' },
    {
      from: 'seller',
      text: 'Samedi matin me va. On se retrouve devant la pharmacie du carrefour, vous pourrez le tester avant de payer.',
    },
    { from: 'buyer', text: 'Parfait, je vous confirme vendredi soir. Merci.' },
  ],
  [
    { from: 'buyer', text: 'Bonsoir, est-ce que le prix est négociable ?' },
    {
      from: 'seller',
      text: "Bonsoir. Je peux descendre un peu si vous prenez rapidement, mais pas beaucoup, l'état est vraiment bon.",
    },
    { from: 'buyer', text: "D'accord, je réfléchis et je reviens vers vous demain." },
  ],
] as const;

export async function seedConversations(
  prisma: PrismaClient,
  accounts: SeedAccounts,
  now: Date,
): Promise<{ conversations: number; messages: number }> {
  const keys: Record<string, SeedKeyPair> = {
    user: generate(),
    pro: generate(),
    admin: generate(),
  };

  for (const [role, pair] of Object.entries(keys)) {
    const account = accounts[role as keyof SeedAccounts];

    await prisma.publicKey.create({
      data: {
        userId: account.id,
        key: pair.publicKey,
        fingerprint: pair.fingerprint,
        deviceLabel: 'Appareil de démonstration',
        createdAt: now,
        lastSeenAt: now,
      },
    });

    await prisma.keyBackup.create({ data: { userId: account.id, ...buildBackup(pair) } });
  }

  // Le compte particulier écrit au compte professionnel à propos de ses annonces.
  const listings = await prisma.listing.findMany({
    where: { sellerId: accounts.pro.id, status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: EXCHANGES.length,
  });

  let messageCount = 0;

  for (const [index, listing] of listings.entries()) {
    const exchange = EXCHANGES[index];
    if (!exchange) continue;

    const conversation = await prisma.conversation.create({
      data: {
        listingId: listing.id,
        buyerId: accounts.user.id,
        sellerId: accounts.pro.id,
        createdAt: addDays(now, -6 + index),
      },
    });

    let lastAt = conversation.createdAt;

    for (const [step, line] of exchange.entries()) {
      const isBuyer = line.from === 'buyer';
      const sender = isBuyer ? keys.user! : keys.pro!;
      const recipient = isBuyer ? keys.pro! : keys.user!;
      const senderId = isBuyer ? accounts.user.id : accounts.pro.id;

      const forRecipient = seal(line.text, recipient.publicKey, sender.secretKey);
      const forSender = seal(line.text, sender.publicKey, sender.secretKey);

      const senderKey = await prisma.publicKey.findUniqueOrThrow({
        where: { key: sender.publicKey },
      });
      const recipientKey = await prisma.publicKey.findUniqueOrThrow({
        where: { key: recipient.publicKey },
      });

      lastAt = new Date(conversation.createdAt.getTime() + step * 45 * 60 * 1000);

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId,
          ciphertext: forRecipient.ciphertext,
          nonce: forRecipient.nonce,
          senderCiphertext: forSender.ciphertext,
          senderNonce: forSender.nonce,
          recipientKeyId: recipientKey.id,
          senderKeyId: senderKey.id,
          createdAt: lastAt,
        },
      });

      messageCount += 1;
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: lastAt, buyerReadAt: lastAt },
    });

    await prisma.listing.update({
      where: { id: listing.id },
      data: { contactCount: exchange.length },
    });
  }

  return { conversations: listings.length, messages: messageCount };
}
