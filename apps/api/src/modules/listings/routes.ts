import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  PAGINATION,
  RATE_LIMITS,
  createListingSchema,
  createReportSchema,
  idSchema,
  listingStatusSchema,
  maskPhone,
  searchListingsSchema,
  updateListingSchema,
} from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import { now } from '../../lib/clock.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import { optionalAuth, requireAuth, requireVerifiedEmail } from '../../middleware/auth.js';
import type { ImageStorage } from '../images/storage.js';
import { getQuota } from './quota.js';
import { countListings, searchListings } from './search.js';
import * as listings from './service.js';

function handle(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

export function listingRouter(prisma: PrismaClient, storage: ImageStorage): Router {
  const router = Router();
  const deps: listings.ListingDeps = { prisma, now };
  const authenticated = requireAuth(prisma);

  function imageUrls(publicId: string | null) {
    return publicId
      ? { url: storage.url(publicId, 'full'), thumbUrl: storage.url(publicId, 'thumb') }
      : { url: null, thumbUrl: null };
  }

  // ── Catalogue ──────────────────────────────────────────────────────────────

  router.get(
    '/catalog',
    handle(async (_req, res) => {
      const [categories, cities] = await Promise.all([
        prisma.category.findMany({ orderBy: { position: 'asc' } }),
        prisma.city.findMany({ orderBy: { position: 'asc' } }),
      ]);
      res.json({ categories, cities });
    }),
  );

  // ── Recherche ──────────────────────────────────────────────────────────────

  router.get(
    '/listings',
    createRateLimiter('search', RATE_LIMITS.search),
    handle(async (req, res) => {
      const input = searchListingsSchema.parse(req.query);
      const [result, total] = await Promise.all([
        searchListings(prisma, input),
        // Le total n'est calculé que sur la première page : il ne change pas
        // pendant le défilement, et la requête coûte cher.
        input.cursor
          ? Promise.resolve<number | undefined>(undefined)
          : countListings(prisma, input),
      ]);

      res.json({
        items: result.items.map((item) => ({
          ...item,
          ...imageUrls(item.imagePublicId),
          rank: undefined,
          imagePublicId: undefined,
        })),
        nextCursor: result.nextCursor,
        ...(total !== undefined && { total }),
      });
    }),
  );

  // ── Quota de l'utilisateur ────────────────────────────────────────────────

  router.get(
    '/listings/quota',
    authenticated,
    handle(async (req, res) => {
      res.json({ quota: await getQuota(prisma, req.auth!.userId, req.auth!.role, now()) });
    }),
  );

  // ── Mes annonces ──────────────────────────────────────────────────────────

  router.get(
    '/listings/mine',
    authenticated,
    handle(async (req, res) => {
      const status = req.query.status ? listingStatusSchema.parse(req.query.status) : undefined;

      const rows = await prisma.listing.findMany({
        where: {
          sellerId: req.auth!.userId,
          deletedAt: null,
          ...(status ? { status } : { status: { not: 'DELETED' } }),
        },
        include: {
          images: { orderBy: { position: 'asc' }, take: 1 },
          city: true,
          category: true,
          _count: { select: { favorites: true, conversations: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: PAGINATION.maxLimit,
      });

      res.json({
        items: rows.map((listing) => ({
          id: listing.id,
          slug: listing.slug,
          title: listing.title,
          price: listing.price,
          priceUnit: listing.priceUnit,
          status: listing.status,
          publishedAt: listing.publishedAt,
          expiresAt: listing.expiresAt,
          rejectionReason: listing.rejectionReason,
          rejectionNote: listing.rejectionNote,
          viewCount: listing.viewCount,
          favoriteCount: listing._count.favorites,
          contactCount: listing._count.conversations,
          cityName: listing.city.name,
          categorySlug: listing.category.slug,
          ...imageUrls(listing.images[0]?.publicId ?? null),
        })),
      });
    }),
  );

  // ── Fiche annonce ─────────────────────────────────────────────────────────

  router.get(
    '/listings/:id',
    optionalAuth(prisma),
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);

      const listing = await prisma.listing.findFirst({
        where: { id, deletedAt: null },
        include: {
          images: { orderBy: { position: 'asc' } },
          city: true,
          category: true,
          seller: {
            select: {
              id: true,
              displayName: true,
              role: true,
              createdAt: true,
              bio: true,
              phone: true,
              city: { select: { name: true } },
            },
          },
        },
      });

      if (!listing) throw HttpError.notFound('LISTING_NOT_FOUND', 'Annonce introuvable');

      // Une annonce non publiée n'est visible que de son auteur et de l'équipe.
      const viewer = req.auth;
      const isOwner = viewer?.userId === listing.sellerId;
      const isStaff = viewer?.role === 'MODERATOR' || viewer?.role === 'ADMIN';

      if (listing.status !== 'PUBLISHED' && !isOwner && !isStaff) {
        throw HttpError.notFound('LISTING_NOT_FOUND', 'Annonce introuvable');
      }

      if (listing.status === 'PUBLISHED' && !isOwner) {
        await listings.recordView(prisma, listing.id, now(), {
          sessionId: typeof req.query.sid === 'string' ? req.query.sid : undefined,
          ip: req.ip,
        });
      }

      const isFavorite = viewer
        ? Boolean(
            await prisma.favorite.findUnique({
              where: { userId_listingId: { userId: viewer.userId, listingId: listing.id } },
            }),
          )
        : false;

      res.json({
        listing: {
          id: listing.id,
          slug: listing.slug,
          title: listing.title,
          description: listing.description,
          price: listing.price,
          priceUnit: listing.priceUnit,
          condition: listing.condition,
          status: listing.status,
          neighbourhood: listing.neighbourhood,
          publishedAt: listing.publishedAt,
          expiresAt: listing.expiresAt,
          viewCount: listing.viewCount,
          city: { slug: listing.city.slug, name: listing.city.name },
          category: {
            slug: listing.category.slug,
            nameFr: listing.category.nameFr,
            nameEn: listing.category.nameEn,
          },
          images: listing.images.map((img) => ({
            id: img.id,
            width: img.width,
            height: img.height,
            ...imageUrls(img.publicId),
          })),
          seller: {
            id: listing.seller.id,
            displayName: listing.seller.displayName,
            isPro: listing.seller.role === 'PRO',
            memberSince: listing.seller.createdAt,
            bio: listing.seller.bio,
            cityName: listing.seller.city?.name ?? null,
            // Aperçu masqué seulement : le numéro complet exige une action
            // explicite, tracée et limitée en fréquence.
            phonePreview: listing.seller.phone ? maskPhone(listing.seller.phone) : null,
          },
          isFavorite,
          isOwner,
        },
      });
    }),
  );

  // ── Affichage du numéro ───────────────────────────────────────────────────

  router.post(
    '/listings/:id/phone',
    optionalAuth(prisma),
    createRateLimiter('revealPhone', RATE_LIMITS.revealPhone, { byUser: true }),
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);

      const listing = await prisma.listing.findFirst({
        where: { id, status: 'PUBLISHED', deletedAt: null },
        include: { seller: { select: { id: true, phone: true } } },
      });

      if (!listing) throw HttpError.notFound('LISTING_NOT_FOUND', 'Annonce introuvable');
      if (!listing.seller.phone) {
        throw HttpError.notFound('NO_PHONE', 'Ce vendeur n’a pas renseigné de numéro');
      }

      // La trace est ce qui permet au vendeur de constater un usage anormal.
      await prisma.phoneReveal.create({
        data: {
          listingId: listing.id,
          viewerId: req.auth?.userId ?? null,
          ipPrefix: req.ip ?? null,
          revealedAt: now(),
        },
      });

      res.json({ phone: listing.seller.phone });
    }),
  );

  // ── Dépôt et modification ─────────────────────────────────────────────────

  router.post(
    '/listings',
    authenticated,
    requireVerifiedEmail,
    createRateLimiter('publishListing', RATE_LIMITS.publishListing, { byUser: true }),
    handle(async (req, res) => {
      const input = createListingSchema.parse(req.body);
      const publish = req.query.draft !== 'true';

      const listing = await listings.createListing(deps, req.auth!.userId, req.auth!.role, input, {
        publish,
      });

      res
        .status(201)
        .json({ listing: { id: listing.id, slug: listing.slug, status: listing.status } });
    }),
  );

  router.patch(
    '/listings/:id',
    authenticated,
    requireVerifiedEmail,
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const input = updateListingSchema.parse(req.body);
      const listing = await listings.updateListing(deps, id, req.auth!.userId, input);
      res.json({ listing: { id: listing.id, slug: listing.slug, status: listing.status } });
    }),
  );

  router.post(
    '/listings/:id/status',
    authenticated,
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const target = listingStatusSchema.parse((req.body as { status?: unknown })?.status);
      const listing = await listings.transitionListing(
        deps,
        id,
        req.auth!.userId,
        req.auth!.role,
        target,
      );
      res.json({ listing: { id: listing.id, status: listing.status } });
    }),
  );

  router.post(
    '/listings/:id/renew',
    authenticated,
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const listing = await listings.renewListing(deps, id, req.auth!.userId);
      res.json({ listing: { id: listing.id, expiresAt: listing.expiresAt } });
    }),
  );

  router.delete(
    '/listings/:id',
    authenticated,
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      await listings.transitionListing(deps, id, req.auth!.userId, req.auth!.role, 'DELETED');
      res.json({ ok: true });
    }),
  );

  // ── Favoris ───────────────────────────────────────────────────────────────

  router.get(
    '/favorites',
    authenticated,
    handle(async (req, res) => {
      const favorites = await prisma.favorite.findMany({
        where: { userId: req.auth!.userId, listing: { deletedAt: null } },
        include: {
          listing: {
            include: { images: { orderBy: { position: 'asc' }, take: 1 }, city: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: PAGINATION.maxLimit,
      });

      res.json({
        items: favorites.map((f) => ({
          id: f.listing.id,
          slug: f.listing.slug,
          title: f.listing.title,
          price: f.listing.price,
          priceUnit: f.listing.priceUnit,
          status: f.listing.status,
          cityName: f.listing.city.name,
          ...imageUrls(f.listing.images[0]?.publicId ?? null),
        })),
      });
    }),
  );

  router.put(
    '/listings/:id/favorite',
    authenticated,
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      const listing = await prisma.listing.findFirst({ where: { id, deletedAt: null } });
      if (!listing) throw HttpError.notFound();

      await prisma.favorite.upsert({
        where: { userId_listingId: { userId: req.auth!.userId, listingId: id } },
        update: {},
        create: { userId: req.auth!.userId, listingId: id },
      });

      const favoriteCount = await prisma.favorite.count({ where: { listingId: id } });
      await prisma.listing.update({ where: { id }, data: { favoriteCount } });

      res.json({ isFavorite: true, favoriteCount });
    }),
  );

  router.delete(
    '/listings/:id/favorite',
    authenticated,
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);
      await prisma.favorite.deleteMany({ where: { userId: req.auth!.userId, listingId: id } });

      const favoriteCount = await prisma.favorite.count({ where: { listingId: id } });
      await prisma.listing.update({ where: { id }, data: { favoriteCount } });

      res.json({ isFavorite: false, favoriteCount });
    }),
  );

  // ── Signalement ───────────────────────────────────────────────────────────

  router.post(
    '/reports',
    authenticated,
    createRateLimiter('createReport', RATE_LIMITS.createReport, { byUser: true }),
    handle(async (req, res) => {
      const input = createReportSchema.parse(req.body);

      const report = await prisma.report.create({
        data: {
          target: input.target,
          targetId: input.targetId,
          authorId: req.auth!.userId,
          reason: input.reason,
          comment: input.comment ?? null,
          createdAt: now(),
          ...(input.target === 'USER' && { reportedUserId: input.targetId }),
          ...(input.target === 'CONVERSATION' && {
            conversationId: input.targetId,
            disclosureConsentAt: input.disclosureConsent ? now() : null,
          }),
          ...(input.disclosedMessages?.length && {
            disclosedMessages: {
              create: input.disclosedMessages.map((m) => ({
                originalMessageId: m.messageId,
                sentAt: new Date(m.sentAt),
                fromReporter: m.fromMe,
                plaintext: m.plaintext,
              })),
            },
          }),
        },
      });

      res.status(201).json({ report: { id: report.id, status: report.status } });
    }),
  );

  // ── Profil public d'un vendeur ────────────────────────────────────────────

  router.get(
    '/sellers/:id',
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);

      const seller = await prisma.user.findFirst({
        where: { id, status: { in: ['ACTIVE', 'SUSPENDED'] }, anonymizedAt: null },
        select: {
          id: true,
          displayName: true,
          role: true,
          bio: true,
          createdAt: true,
          city: { select: { name: true } },
        },
      });

      if (!seller) throw HttpError.notFound('SELLER_NOT_FOUND', 'Vendeur introuvable');

      const items = await prisma.listing.findMany({
        where: { sellerId: id, status: 'PUBLISHED', deletedAt: null },
        include: { images: { orderBy: { position: 'asc' }, take: 1 }, city: true },
        orderBy: { publishedAt: 'desc' },
        take: PAGINATION.maxLimit,
      });

      res.json({
        seller: {
          id: seller.id,
          displayName: seller.displayName,
          isPro: seller.role === 'PRO',
          bio: seller.bio,
          memberSince: seller.createdAt,
          cityName: seller.city?.name ?? null,
          listingCount: items.length,
        },
        items: items.map((listing) => ({
          id: listing.id,
          slug: listing.slug,
          title: listing.title,
          price: listing.price,
          priceUnit: listing.priceUnit,
          cityName: listing.city.name,
          publishedAt: listing.publishedAt,
          ...imageUrls(listing.images[0]?.publicId ?? null),
        })),
      });
    }),
  );

  return router;
}
