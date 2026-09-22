import type { PrismaClient } from '@prisma/client';
import { LISTING_LIMITS, addDays, type ModerateListingInput } from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import type { MailService } from '../mail/service.js';
import { recordAudit } from './audit.js';

export interface ModerationDeps {
  prisma: PrismaClient;
  mail: MailService;
  now: () => Date;
}

/**
 * File de modération.
 *
 * Les annonces repérées par le filtre automatique remontent en tête, par score
 * de risque décroissant. Le filtre ne décide de rien : il ne fait que placer
 * devant les yeux du modérateur ce qui mérite d'être regardé en premier.
 */
export async function moderationQueue(
  prisma: PrismaClient,
  options: { limit: number; cursor?: string | undefined },
) {
  const rows = await prisma.listing.findMany({
    where: {
      status: 'PENDING',
      deletedAt: null,
      ...(options.cursor && { createdAt: { gt: new Date(options.cursor) } }),
    },
    include: {
      images: { orderBy: { position: 'asc' } },
      city: true,
      category: true,
      seller: {
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          createdAt: true,
          status: true,
          _count: { select: { listings: true, reportsReceived: true } },
        },
      },
      moderationFlags: { orderBy: { severity: 'desc' } },
    },
    orderBy: { createdAt: 'asc' },
    take: options.limit + 1,
  });

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;

  const items = page.map((listing) => ({
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    priceUnit: listing.priceUnit,
    condition: listing.condition,
    neighbourhood: listing.neighbourhood,
    createdAt: listing.createdAt,
    cityName: listing.city.name,
    categoryNameFr: listing.category.nameFr,
    images: listing.images.map((image) => ({ id: image.id, publicId: image.publicId })),
    seller: {
      id: listing.seller.id,
      displayName: listing.seller.displayName,
      email: listing.seller.email,
      isPro: listing.seller.role === 'PRO',
      status: listing.seller.status,
      memberSince: listing.seller.createdAt,
      listingCount: listing.seller._count.listings,
      reportCount: listing.seller._count.reportsReceived,
    },
    flags: listing.moderationFlags.map((flag) => ({
      rule: flag.rule,
      matchedOn: flag.matchedOn,
      severity: flag.severity,
    })),
    riskScore: listing.moderationFlags.reduce((total, flag) => total + flag.severity, 0),
  }));

  // Tri final en mémoire : le score de risque se calcule par agrégation des
  // signalements automatiques, ce qu'une clause ORDER BY ne ferait pas
  // simplement sans jointure coûteuse sur une file qui reste courte.
  items.sort((a, b) => b.riskScore - a.riskScore || a.createdAt.getTime() - b.createdAt.getTime());

  return {
    items,
    nextCursor: hasMore ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
  };
}

/**
 * Publie ou refuse une annonce.
 *
 * Un refus sans motif n'existe pas : le schéma l'impose, et l'auteur le reçoit
 * par e-mail. Une décision qu'on ne peut pas expliquer n'est pas une décision
 * de modération, c'est un caprice.
 */
export async function moderateListing(
  deps: ModerationDeps,
  listingId: string,
  moderatorId: string,
  input: ModerateListingInput,
  ip?: string,
) {
  const now = deps.now();

  const listing = await deps.prisma.listing.findFirst({
    where: { id: listingId, deletedAt: null },
    include: { seller: true, category: true },
  });

  if (!listing) throw HttpError.notFound('LISTING_NOT_FOUND', 'Annonce introuvable');
  if (listing.status !== 'PENDING') {
    throw HttpError.conflict(
      'ALREADY_MODERATED',
      'Cette annonce a déjà été traitée par un autre modérateur',
    );
  }

  if (input.decision === 'APPROVE') {
    const updated = await deps.prisma.listing.update({
      where: { id: listingId },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
        expiresAt: addDays(now, LISTING_LIMITS.publishedLifetimeDays),
        moderatedAt: now,
        moderatedById: moderatorId,
        rejectionReason: null,
        rejectionNote: null,
        // Le badge Pro est recopié à la publication : le vendeur a pu changer
        // de statut entre le dépôt et la validation.
        sellerIsPro: listing.seller.role === 'PRO',
      },
    });

    await recordAudit(
      deps.prisma,
      {
        actorId: moderatorId,
        action: 'LISTING_APPROVED',
        targetType: 'Listing',
        targetId: listingId,
        reason: input.note,
        metadata: { title: listing.title, sellerId: listing.sellerId },
        ip,
      },
      now,
    );

    await deps.mail.sendListingApproved(listing.seller, {
      title: listing.title,
      slug: listing.slug,
      listingId: listing.id,
    });

    return updated;
  }

  const updated = await deps.prisma.listing.update({
    where: { id: listingId },
    data: {
      status: 'REJECTED',
      publishedAt: null,
      moderatedAt: now,
      moderatedById: moderatorId,
      rejectionReason: input.reason,
      rejectionNote: input.note ?? null,
    },
  });

  await recordAudit(
    deps.prisma,
    {
      actorId: moderatorId,
      action: 'LISTING_REJECTED',
      targetType: 'Listing',
      targetId: listingId,
      reason: input.reason,
      metadata: { title: listing.title, sellerId: listing.sellerId, note: input.note ?? null },
      ip,
    },
    now,
  );

  await deps.mail.sendListingRejected(listing.seller, {
    title: listing.title,
    reason: input.reason,
    note: input.note ?? null,
  });

  return updated;
}

/** Retrait d'une annonce déjà en ligne, sur signalement ou constat. */
export async function takeDownListing(
  deps: ModerationDeps,
  listingId: string,
  moderatorId: string,
  reason: string,
  ip?: string,
) {
  const now = deps.now();

  const listing = await deps.prisma.listing.findFirst({
    where: { id: listingId, deletedAt: null },
    include: { seller: true },
  });

  if (!listing) throw HttpError.notFound('LISTING_NOT_FOUND', 'Annonce introuvable');

  const updated = await deps.prisma.listing.update({
    where: { id: listingId },
    data: {
      status: 'REJECTED',
      publishedAt: null,
      moderatedAt: now,
      moderatedById: moderatorId,
      rejectionReason: 'OTHER',
      rejectionNote: reason,
    },
  });

  await recordAudit(
    deps.prisma,
    {
      actorId: moderatorId,
      action: 'LISTING_DELETED',
      targetType: 'Listing',
      targetId: listingId,
      reason,
      metadata: { title: listing.title, sellerId: listing.sellerId },
      ip,
    },
    now,
  );

  await deps.mail.sendListingRejected(listing.seller, {
    title: listing.title,
    reason: 'OTHER',
    note: reason,
  });

  return updated;
}
