import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  PAGINATION,
  RATE_LIMITS,
  blockUserSchema,
  cursorPaginationSchema,
  idSchema,
  keyBackupSchema,
  registerPublicKeySchema,
  sendMessageSchema,
  startConversationSchema,
} from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import { now } from '../../lib/clock.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { requireAuth, requireVerifiedEmail } from '../../middleware/auth.js';
import * as keys from './keys.js';
import * as conversations from './conversations.js';
import type { RealtimeHub } from './realtime.js';

function handle(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

export function messagingRouter(prisma: PrismaClient, hub: RealtimeHub): Router {
  const router = Router();
  const authenticated = requireAuth(prisma);

  // ── Clés ──────────────────────────────────────────────────────────────────

  router.post(
    '/keys',
    authenticated,
    handle(async (req, res) => {
      const input = registerPublicKeySchema.parse(req.body);
      const label =
        typeof (req.body as { deviceLabel?: unknown }).deviceLabel === 'string'
          ? (req.body as { deviceLabel: string }).deviceLabel.slice(0, 80)
          : undefined;

      const key = await keys.registerKey(
        prisma,
        req.auth!.userId,
        input.publicKey,
        input.fingerprint,
        now(),
        label,
      );

      res.status(201).json({
        key: { id: key.id, fingerprint: key.fingerprint, createdAt: key.createdAt },
      });
    }),
  );

  router.get(
    '/keys/me',
    authenticated,
    handle(async (req, res) => {
      const key = await keys.activeKey(prisma, req.auth!.userId);
      res.json({
        key: key
          ? {
              id: key.id,
              publicKey: key.key,
              fingerprint: key.fingerprint,
              deviceLabel: key.deviceLabel,
              createdAt: key.createdAt,
            }
          : null,
      });
    }),
  );

  router.get(
    '/keys/:userId',
    authenticated,
    handle(async (req, res) => {
      const userId = idSchema.parse(req.params.userId);
      const key = await keys.publicKeyOf(prisma, userId);
      if (!key) throw HttpError.notFound('NO_KEY', 'Ce membre n’a pas encore de clé publique');
      res.json({ key });
    }),
  );

  // ── Sauvegarde chiffrée de la clé privée ──────────────────────────────────

  router.put(
    '/keys/backup',
    authenticated,
    handle(async (req, res) => {
      const input = keyBackupSchema.parse(req.body);
      await keys.saveBackup(prisma, req.auth!.userId, input);
      res.json({ ok: true });
    }),
  );

  router.get(
    '/keys/backup/mine',
    authenticated,
    handle(async (req, res) => {
      res.json({ backup: await keys.getBackup(prisma, req.auth!.userId) });
    }),
  );

  router.delete(
    '/keys/backup/mine',
    authenticated,
    handle(async (req, res) => {
      await keys.deleteBackup(prisma, req.auth!.userId);
      res.json({ ok: true });
    }),
  );

  // ── Conversations ─────────────────────────────────────────────────────────

  router.post(
    '/conversations',
    authenticated,
    requireVerifiedEmail,
    handle(async (req, res) => {
      const { listingId } = startConversationSchema.parse(req.body);
      const conversation = await conversations.openConversation(
        prisma,
        req.auth!.userId,
        listingId,
        now(),
      );
      res.status(201).json({ conversation: { id: conversation.id } });
    }),
  );

  router.get(
    '/conversations',
    authenticated,
    handle(async (req, res) => {
      const userId = req.auth!.userId;

      const rows = await prisma.conversation.findMany({
        where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
        include: {
          listing: {
            select: {
              id: true,
              slug: true,
              title: true,
              price: true,
              priceUnit: true,
              images: { orderBy: { position: 'asc' }, take: 1, select: { publicId: true } },
            },
          },
          buyer: { select: { id: true, displayName: true, role: true } },
          seller: { select: { id: true, displayName: true, role: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        take: PAGINATION.maxLimit,
      });

      res.json({
        items: rows.map((row) => {
          const isBuyer = row.buyerId === userId;
          const other = isBuyer ? row.seller : row.buyer;
          const readAt = isBuyer ? row.buyerReadAt : row.sellerReadAt;
          const last = row.messages[0];

          return {
            id: row.id,
            listing: {
              id: row.listing.id,
              slug: row.listing.slug,
              title: row.listing.title,
              price: row.listing.price,
              priceUnit: row.listing.priceUnit,
              imagePublicId: row.listing.images[0]?.publicId ?? null,
            },
            other: { id: other.id, displayName: other.displayName, isPro: other.role === 'PRO' },
            lastMessageAt: row.lastMessageAt,
            // Aucun aperçu du dernier message : le serveur ne peut pas le lire,
            // et le client affiche son propre aperçu après déchiffrement.
            unread: Boolean(
              last && last.senderId !== userId && (!readAt || last.createdAt > readAt),
            ),
          };
        }),
      });
    }),
  );

  router.get(
    '/conversations/:id',
    authenticated,
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const userId = req.auth!.userId;
      const { conversation, otherUserId } = await conversations.requireParticipant(
        prisma,
        id,
        userId,
      );

      const [other, otherKey, listing, blocked] = await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: otherUserId },
          select: { id: true, displayName: true, role: true, createdAt: true },
        }),
        keys.publicKeyOf(prisma, otherUserId),
        prisma.listing.findUniqueOrThrow({
          where: { id: conversation.listingId },
          select: {
            id: true,
            slug: true,
            title: true,
            price: true,
            priceUnit: true,
            status: true,
            images: { orderBy: { position: 'asc' }, take: 1, select: { publicId: true } },
          },
        }),
        prisma.block.findFirst({
          where: {
            OR: [
              { authorId: userId, targetId: otherUserId },
              { authorId: otherUserId, targetId: userId },
            ],
          },
          select: { authorId: true },
        }),
      ]);

      res.json({
        conversation: {
          id: conversation.id,
          listing: {
            ...listing,
            imagePublicId: listing.images[0]?.publicId ?? null,
            images: undefined,
          },
          other: {
            id: other.id,
            displayName: other.displayName,
            isPro: other.role === 'PRO',
            memberSince: other.createdAt,
            publicKey: otherKey?.key ?? null,
            // L'empreinte permet une vérification de vive voix, et son
            // changement doit alerter : c'est le seul garde-fou contre un
            // serveur qui substituerait une clé.
            fingerprint: otherKey?.fingerprint ?? null,
            keyCreatedAt: otherKey?.createdAt ?? null,
          },
          blockedByMe: blocked?.authorId === userId,
          blocked: Boolean(blocked),
        },
      });
    }),
  );

  router.get(
    '/conversations/:id/messages',
    authenticated,
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const { limit, cursor } = cursorPaginationSchema.parse(req.query);
      await conversations.requireParticipant(prisma, id, req.auth!.userId);

      const messages = await prisma.message.findMany({
        where: { conversationId: id, ...(cursor && { createdAt: { lt: new Date(cursor) } }) },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = messages.length > limit;
      const page = hasMore ? messages.slice(0, limit) : messages;

      res.json({
        // Renvoyés du plus ancien au plus récent : c'est l'ordre d'affichage.
        items: page.reverse().map((m) => ({
          id: m.id,
          senderId: m.senderId,
          ciphertext: m.ciphertext,
          nonce: m.nonce,
          senderCiphertext: m.senderCiphertext,
          senderNonce: m.senderNonce,
          recipientKeyId: m.recipientKeyId,
          senderKeyId: m.senderKeyId,
          readAt: m.readAt,
          createdAt: m.createdAt,
        })),
        nextCursor: hasMore ? page[0]?.createdAt.toISOString() : null,
      });
    }),
  );

  router.post(
    '/messages',
    authenticated,
    requireVerifiedEmail,
    createRateLimiter('sendMessage', RATE_LIMITS.sendMessage, { byUser: true }),
    handle(async (req, res) => {
      const input = sendMessageSchema.parse(req.body);
      const message = await conversations.sendMessage(prisma, req.auth!.userId, input, now());

      const { otherUserId } = await conversations.requireParticipant(
        prisma,
        input.conversationId,
        req.auth!.userId,
      );

      // Le temps réel ne transporte que du chiffré, comme le reste.
      hub.notifyMessage(otherUserId, {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        ciphertext: message.ciphertext,
        nonce: message.nonce,
        senderCiphertext: message.senderCiphertext,
        senderNonce: message.senderNonce,
        recipientKeyId: message.recipientKeyId,
        senderKeyId: message.senderKeyId,
        createdAt: message.createdAt.toISOString(),
      });

      res.status(201).json({
        message: { id: message.id, createdAt: message.createdAt },
      });
    }),
  );

  router.post(
    '/conversations/:id/read',
    authenticated,
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      await conversations.markRead(prisma, id, req.auth!.userId, now());
      res.json({ ok: true });
    }),
  );

  // ── Blocage ───────────────────────────────────────────────────────────────

  router.post(
    '/blocks',
    authenticated,
    handle(async (req, res) => {
      const { userId } = blockUserSchema.parse(req.body);
      if (userId === req.auth!.userId) {
        throw HttpError.badRequest('SELF_BLOCK', 'Vous ne pouvez pas vous bloquer vous-même');
      }

      await prisma.block.upsert({
        where: { authorId_targetId: { authorId: req.auth!.userId, targetId: userId } },
        update: {},
        create: { authorId: req.auth!.userId, targetId: userId },
      });

      res.status(201).json({ ok: true });
    }),
  );

  router.delete(
    '/blocks/:userId',
    authenticated,
    handle(async (req, res) => {
      const userId = idSchema.parse(req.params.userId);
      await prisma.block.deleteMany({ where: { authorId: req.auth!.userId, targetId: userId } });
      res.json({ ok: true });
    }),
  );

  router.get(
    '/blocks',
    authenticated,
    handle(async (req, res) => {
      const blocks = await prisma.block.findMany({
        where: { authorId: req.auth!.userId },
        include: { target: { select: { id: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        items: blocks.map((b) => ({
          userId: b.target.id,
          displayName: b.target.displayName,
          createdAt: b.createdAt,
        })),
      });
    }),
  );

  return router;
}
