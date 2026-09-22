import nacl from 'tweetnacl';
import { argon2id } from '@noble/hashes/argon2.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { SEED_PASSPHRASE } from '../../prisma/seed/conversations.js';
import { computeFingerprint } from '../../src/modules/messaging/fingerprint.js';

/**
 * Vérification de bout en bout du jeu de démonstration.
 *
 * Elle refait le parcours réel d'un utilisateur qui change d'appareil :
 * restaurer sa clé privée depuis la sauvegarde chiffrée, puis relire ses
 * conversations. Si le format de sauvegarde produit par le client et celui
 * attendu par le seed venaient à diverger, ce test le verrait immédiatement.
 */

const prisma = new PrismaClient();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let disponible = false;

beforeAll(async () => {
  disponible = (await prisma.keyBackup.count()) > 0;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function restore(backup: {
  encryptedPrivateKey: string;
  salt: string;
  nonce: string;
  kdfParams: unknown;
}): Uint8Array | null {
  const params = backup.kdfParams as { memoryKiB: number; iterations: number; parallelism: number };

  const key = argon2id(encoder.encode(SEED_PASSPHRASE), Buffer.from(backup.salt, 'base64'), {
    m: params.memoryKiB,
    t: params.iterations,
    p: params.parallelism,
    dkLen: nacl.secretbox.keyLength,
  });

  return nacl.secretbox.open(
    Buffer.from(backup.encryptedPrivateKey, 'base64'),
    Buffer.from(backup.nonce, 'base64'),
    key,
  );
}

describe('jeu de démonstration chiffré', () => {
  it('restaure la clé privée depuis la sauvegarde, avec la phrase documentée', async () => {
    if (!disponible) return;

    const utilisateur = await prisma.user.findUniqueOrThrow({
      where: { email: 'utilisateur@inbox.cm' },
    });
    const backup = await prisma.keyBackup.findUniqueOrThrow({
      where: { userId: utilisateur.id },
    });

    const secretKey = restore(backup);
    expect(secretKey).not.toBeNull();

    // La clé restaurée correspond bien à la clé publique enregistrée.
    const publique = await prisma.publicKey.findFirstOrThrow({
      where: { userId: utilisateur.id, retiredAt: null },
    });
    const derivee = Buffer.from(nacl.box.keyPair.fromSecretKey(secretKey!).publicKey).toString(
      'base64',
    );
    expect(derivee).toBe(publique.key);
    expect(computeFingerprint(publique.key)).toBe(publique.fingerprint);
  });

  it('une mauvaise phrase secrète ne restaure rien', async () => {
    if (!disponible) return;

    const utilisateur = await prisma.user.findUniqueOrThrow({
      where: { email: 'utilisateur@inbox.cm' },
    });
    const backup = await prisma.keyBackup.findUniqueOrThrow({
      where: { userId: utilisateur.id },
    });

    const params = backup.kdfParams as {
      memoryKiB: number;
      iterations: number;
      parallelism: number;
    };
    const mauvaiseCle = argon2id(
      encoder.encode('mauvaise-phrase-secrete'),
      Buffer.from(backup.salt, 'base64'),
      { m: params.memoryKiB, t: params.iterations, p: params.parallelism, dkLen: 32 },
    );

    const tentative = nacl.secretbox.open(
      Buffer.from(backup.encryptedPrivateKey, 'base64'),
      Buffer.from(backup.nonce, 'base64'),
      mauvaiseCle,
    );

    expect(tentative).toBeNull();
  });

  it('relit les conversations de démonstration après restauration', async () => {
    if (!disponible) return;

    const [acheteur, vendeur] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: 'utilisateur@inbox.cm' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'pro@inbox.cm' } }),
    ]);

    const [sauvegardeAcheteur, clePubliqueVendeur, clePubliqueAcheteur] = await Promise.all([
      prisma.keyBackup.findUniqueOrThrow({ where: { userId: acheteur.id } }),
      prisma.publicKey.findFirstOrThrow({ where: { userId: vendeur.id, retiredAt: null } }),
      prisma.publicKey.findFirstOrThrow({ where: { userId: acheteur.id, retiredAt: null } }),
    ]);

    const secretAcheteur = restore(sauvegardeAcheteur);
    expect(secretAcheteur).not.toBeNull();

    const conversation = await prisma.conversation.findFirstOrThrow({
      where: { buyerId: acheteur.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    expect(conversation.messages.length).toBeGreaterThan(0);

    const lus = conversation.messages.map((message) => {
      const versMoi = message.senderId !== acheteur.id;

      const opened = nacl.box.open(
        Buffer.from(versMoi ? message.ciphertext : message.senderCiphertext, 'base64'),
        Buffer.from(versMoi ? message.nonce : message.senderNonce, 'base64'),
        Buffer.from(versMoi ? clePubliqueVendeur.key : clePubliqueAcheteur.key, 'base64'),
        secretAcheteur!,
      );

      return opened ? decoder.decode(opened) : null;
    });

    // Tous les messages sont lisibles par leur destinataire légitime.
    expect(lus.every((texte) => texte !== null)).toBe(true);
    // Le seed contient deux échanges ; l'un commence par « Bonjour », l'autre
    // par « Bonsoir ». On ne présume pas lequel a été tiré.
    expect(lus.join(' ')).toMatch(/Bonjour|Bonsoir/);
  });

  it('aucun message du jeu de démonstration n’est stocké en clair', async () => {
    if (!disponible) return;

    const messages = await prisma.message.findMany();
    expect(messages.length).toBeGreaterThan(0);

    const enBase = JSON.stringify(messages);
    for (const extrait of ['Bonjour', 'disponible', 'pharmacie', 'négociable', 'samedi']) {
      expect(enBase).not.toContain(extrait);
    }
  });
});
