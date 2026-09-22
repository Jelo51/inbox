import type { Conversation, Message, PrismaClient } from '@prisma/client';
import type { SendMessageInput } from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import { activeKey } from './keys.js';

/**
 * Une conversation naît toujours d'une annonce. Sans cette contrainte, la
 * messagerie deviendrait un canal de démarchage à froid, et la promesse faite
 * aux vendeurs — « on ne vous écrit qu'à propos de vos annonces » — tomberait.
 */
export async function openConversation(
  prisma: PrismaClient,
  buyerId: string,
  listingId: string,
  now: Date,
): Promise<Conversation> {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, deletedAt: null },
    select: { id: true, sellerId: true, status: true },
  });

  if (!listing) throw HttpError.notFound('LISTING_NOT_FOUND', 'Annonce introuvable');
  if (listing.sellerId === buyerId) {
    throw HttpError.badRequest('OWN_LISTING', 'Vous ne pouvez pas vous écrire à vous-même');
  }
  if (listing.status !== 'PUBLISHED') {
    throw HttpError.conflict('LISTING_NOT_AVAILABLE', 'Cette annonce n’est plus en ligne');
  }

  await assertNotBlocked(prisma, buyerId, listing.sellerId);

  // Sans clé publique, le vendeur ne pourrait pas lire le message : mieux vaut
  // le dire tout de suite que de laisser partir un message illisible.
  if (!(await activeKey(prisma, listing.sellerId))) {
    throw HttpError.conflict(
      'RECIPIENT_HAS_NO_KEY',
      'Ce vendeur n’a pas encore activé sa messagerie chiffrée. Réessayez plus tard.',
    );
  }

  return prisma.conversation.upsert({
    where: { listingId_buyerId: { listingId, buyerId } },
    update: {},
    create: { listingId, buyerId, sellerId: listing.sellerId, createdAt: now },
  });
}

/** Un blocage vaut dans les deux sens : ni l'un ni l'autre ne peut relancer. */
export async function assertNotBlocked(prisma: PrismaClient, a: string, b: string): Promise<void> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { authorId: a, targetId: b },
        { authorId: b, targetId: a },
      ],
    },
  });

  if (block) {
    throw HttpError.forbidden('BLOCKED', 'Cette conversation n’est plus possible');
  }
}

export interface ConversationParticipant {
  conversation: Conversation;
  isBuyer: boolean;
  otherUserId: string;
}

/** Vérifie que l'appelant fait bien partie de la conversation. */
export async function requireParticipant(
  prisma: PrismaClient,
  conversationId: string,
  userId: string,
): Promise<ConversationParticipant> {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });

  if (!conversation) throw HttpError.notFound('CONVERSATION_NOT_FOUND', 'Conversation introuvable');

  if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
    // 404 plutôt que 403 : répondre « interdit » confirmerait l'existence de
    // la conversation à quelqu'un qui n'a rien à y voir.
    throw HttpError.notFound('CONVERSATION_NOT_FOUND', 'Conversation introuvable');
  }

  const isBuyer = conversation.buyerId === userId;
  return {
    conversation,
    isBuyer,
    otherUserId: isBuyer ? conversation.sellerId : conversation.buyerId,
  };
}

/**
 * Enregistre un message. Le serveur reçoit deux chiffrés — un pour le
 * destinataire, un pour l'expéditeur — et ne peut ouvrir ni l'un ni l'autre.
 * La copie pour l'expéditeur est indispensable : sans elle, il ne pourrait pas
 * relire ses propres messages après restauration sur un autre appareil.
 */
export async function sendMessage(
  prisma: PrismaClient,
  senderId: string,
  input: SendMessageInput,
  now: Date,
): Promise<Message> {
  const { conversation, isBuyer, otherUserId } = await requireParticipant(
    prisma,
    input.conversationId,
    senderId,
  );

  await assertNotBlocked(prisma, senderId, otherUserId);

  const [senderKey, recipientKey] = await Promise.all([
    activeKey(prisma, senderId),
    activeKey(prisma, otherUserId),
  ]);

  if (!senderKey) throw HttpError.conflict('NO_KEY', 'Activez votre messagerie chiffrée');
  if (!recipientKey) {
    throw HttpError.conflict('RECIPIENT_HAS_NO_KEY', 'Votre correspondant n’a pas de clé active');
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId,
      ciphertext: input.ciphertext,
      nonce: input.nonce,
      senderCiphertext: input.senderCiphertext,
      senderNonce: input.senderNonce,
      recipientKeyId: recipientKey.id,
      senderKeyId: senderKey.id,
      createdAt: now,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: now,
      // L'expéditeur a évidemment lu son propre message.
      ...(isBuyer ? { buyerReadAt: now } : { sellerReadAt: now }),
    },
  });

  await prisma.listing.update({
    where: { id: conversation.listingId },
    data: { contactCount: { increment: 1 } },
  });

  return message;
}

export async function markRead(
  prisma: PrismaClient,
  conversationId: string,
  userId: string,
  now: Date,
): Promise<void> {
  const { isBuyer } = await requireParticipant(prisma, conversationId, userId);

  await prisma.conversation.update({
    where: { id: conversationId },
    data: isBuyer ? { buyerReadAt: now } : { sellerReadAt: now },
  });

  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: now },
  });
}
