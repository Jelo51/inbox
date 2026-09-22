import type { PrismaClient, PublicKey } from '@prisma/client';
import type { KeyBackupInput } from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import { fingerprintMatches } from './fingerprint.js';

/**
 * Le serveur ne détient que des clés publiques et un blob de sauvegarde qu'il
 * ne peut pas ouvrir. Aucune fonction de ce module ne manipule de clé privée
 * en clair, et c'est la propriété qui rend la promesse de chiffrement vraie.
 */

export async function activeKey(prisma: PrismaClient, userId: string): Promise<PublicKey | null> {
  return prisma.publicKey.findFirst({
    where: { userId, retiredAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Enregistre la clé publique d'un appareil.
 *
 * Une clé déjà connue est simplement rafraîchie : c'est le cas normal d'un
 * appareil qui a restauré sa sauvegarde. Une clé différente **retire** la
 * précédente, ce qui rend les anciens messages illisibles pour l'utilisateur
 * s'il n'a pas gardé sa clé privée — d'où l'avertissement côté interface.
 */
export async function registerKey(
  prisma: PrismaClient,
  userId: string,
  publicKey: string,
  fingerprint: string,
  now: Date,
  deviceLabel?: string,
): Promise<PublicKey> {
  if (!fingerprintMatches(publicKey, fingerprint)) {
    throw HttpError.badRequest(
      'FINGERPRINT_MISMATCH',
      'L’empreinte ne correspond pas à la clé publique fournie',
    );
  }

  const existing = await prisma.publicKey.findUnique({ where: { key: publicKey } });

  if (existing) {
    if (existing.userId !== userId) {
      throw HttpError.conflict('KEY_ALREADY_USED', 'Cette clé publique est déjà enregistrée');
    }
    return prisma.publicKey.update({
      where: { id: existing.id },
      data: { lastSeenAt: now, retiredAt: null, ...(deviceLabel && { deviceLabel }) },
    });
  }

  // Les clés retirées restent en base : sans elles, les messages déjà échangés
  // ne pourraient plus être rattachés à la clé qui les a chiffrés.
  await prisma.publicKey.updateMany({
    where: { userId, retiredAt: null },
    data: { retiredAt: now },
  });

  return prisma.publicKey.create({
    data: {
      userId,
      key: publicKey,
      fingerprint,
      deviceLabel: deviceLabel ?? null,
      createdAt: now,
      lastSeenAt: now,
    },
  });
}

/** Clé publique d'un correspondant, pour lui écrire. */
export async function publicKeyOf(
  prisma: PrismaClient,
  userId: string,
): Promise<{ key: string; fingerprint: string; createdAt: Date } | null> {
  const record = await activeKey(prisma, userId);
  return record
    ? { key: record.key, fingerprint: record.fingerprint, createdAt: record.createdAt }
    : null;
}

/**
 * Sauvegarde de la clé privée. Le blob arrive déjà chiffré par une phrase
 * secrète que le serveur ne voit jamais : il stocke des octets inertes.
 */
export async function saveBackup(
  prisma: PrismaClient,
  userId: string,
  input: KeyBackupInput,
): Promise<void> {
  await prisma.keyBackup.upsert({
    where: { userId },
    update: {
      encryptedPrivateKey: input.encryptedPrivateKey,
      salt: input.salt,
      nonce: input.nonce,
      kdf: input.kdf,
      kdfParams: input.kdfParams,
    },
    create: {
      userId,
      encryptedPrivateKey: input.encryptedPrivateKey,
      salt: input.salt,
      nonce: input.nonce,
      kdf: input.kdf,
      kdfParams: input.kdfParams,
    },
  });
}

export async function getBackup(prisma: PrismaClient, userId: string) {
  const backup = await prisma.keyBackup.findUnique({ where: { userId } });
  if (!backup) throw HttpError.notFound('NO_BACKUP', 'Aucune sauvegarde de clé enregistrée');

  return {
    encryptedPrivateKey: backup.encryptedPrivateKey,
    salt: backup.salt,
    nonce: backup.nonce,
    kdf: backup.kdf,
    kdfParams: backup.kdfParams,
    createdAt: backup.createdAt,
    updatedAt: backup.updatedAt,
  };
}

export async function deleteBackup(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.keyBackup.deleteMany({ where: { userId } });
}
