import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from '../../lib/logger.js';
import type { ImageStorage } from '../images/storage.js';

/**
 * Suppression de compte en libre-service, par **anonymisation**.
 *
 * Supprimer réellement la ligne `User` est impossible : `Receipt` est en
 * `Restrict` sur son paiement, délibérément — une pièce comptable ne disparaît
 * pas parce qu'un compte s'en va, et la loi impose de la conserver dix ans. Le
 * compte est donc vidé de tout ce qui identifie une personne, et ce qui reste
 * ne se rattache plus à personne.
 *
 * Deux relations demandent une purge explicite, parce qu'elles survivraient à
 * une suppression en cascade :
 *
 * - `Report.authorId` est en `SetNull` : les signalements resteraient, et avec
 *   eux les messages transmis en clair dans `DisclosedMessage` — le seul texte
 *   de conversation lisible du système.
 * - `PhoneReveal.viewerId` est en `SetNull` : les demandes de numéro
 *   resteraient attachées aux annonces d'autrui.
 */

export interface DeletionDeps {
  prisma: PrismaClient;
  storage: ImageStorage;
  logger: Logger;
}

export interface DeletionReport {
  listings: number;
  images: number;
  conversations: number;
  messages: number;
  reports: number;
  disclosedMessages: number;
}

export async function anonymizeAccount(
  deps: DeletionDeps,
  userId: string,
  at: Date,
): Promise<DeletionReport> {
  const { prisma, storage, logger } = deps;

  // Les fichiers vivent hors de la base : ils se suppriment avant, sinon on
  // perd la liste des identifiants à supprimer.
  const images = await prisma.listingImage.findMany({
    where: { listing: { sellerId: userId } },
    select: { publicId: true },
  });

  for (const image of images) {
    try {
      await storage.remove(image.publicId);
    } catch (err) {
      // Un fichier déjà absent ne doit pas empêcher la suppression du compte :
      // l'utilisateur a demandé son effacement, il l'obtient.
      logger.warn({ err, publicId: image.publicId }, 'image non supprimée');
    }
  }

  const report = await prisma.$transaction(async (tx) => {
    const reports = await tx.report.findMany({
      where: { authorId: userId },
      select: { id: true, _count: { select: { disclosedMessages: true } } },
    });
    const disclosedMessages = reports.reduce((n, r) => n + r._count.disclosedMessages, 0);

    // `DisclosedMessage` part en cascade avec son signalement ; c'est le seul
    // endroit du système où du texte de conversation existe en clair.
    await tx.report.deleteMany({ where: { authorId: userId } });
    await tx.phoneReveal.deleteMany({ where: { viewerId: userId } });

    const conversations = await tx.conversation.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      select: { id: true, _count: { select: { messages: true } } },
    });
    const messages = conversations.reduce((n, c) => n + c._count.messages, 0);

    // Une conversation n'a plus d'objet dès qu'une des deux parties s'en va :
    // l'autre ne pourrait de toute façon plus rien en faire.
    await tx.conversation.deleteMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    });

    const { count: listings } = await tx.listing.deleteMany({ where: { sellerId: userId } });

    await tx.favorite.deleteMany({ where: { userId } });
    await tx.block.deleteMany({ where: { OR: [{ authorId: userId }, { targetId: userId }] } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.emailToken.deleteMany({ where: { userId } });
    await tx.publicKey.deleteMany({ where: { userId } });
    await tx.keyBackup.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });
    await tx.consentRecord.deleteMany({ where: { userId } });

    // L'adresse est remplacée par une valeur unique et sans signification :
    // laisser l'ancienne permettrait de savoir qui avait un compte, et la
    // vider casserait la contrainte d'unicité au deuxième compte supprimé.
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `supprime+${randomUUID()}@invalid`,
        // Une empreinte argon2id impossible à obtenir : le compte ne peut plus
        // servir à se connecter, et aucun mot de passe ne correspond.
        passwordHash: `supprime:${randomUUID()}`,
        displayName: 'Compte supprimé',
        phone: null,
        bio: null,
        avatarUrl: null,
        cityId: null,
        status: 'DELETED',
        role: 'USER',
        emailVerifiedAt: null,
        adultDeclaredAt: null,
        suspendedUntil: null,
        suspendedFor: null,
        bannedAt: null,
        bannedFor: null,
        lastLoginAt: null,
        anonymizedAt: at,
      },
    });

    return {
      listings,
      images: images.length,
      conversations: conversations.length,
      messages,
      reports: reports.length,
      disclosedMessages,
    };
  });

  logger.info({ ...report }, 'compte anonymisé');
  return report;
}
