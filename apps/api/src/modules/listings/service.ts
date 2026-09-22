import { createHash } from 'node:crypto';
import type { Listing, PrismaClient } from '@prisma/client';
import {
  LISTING_LIMITS,
  addDays,
  canTransition,
  slugify,
  truncateIp,
  type CreateListingInput,
  type ListingStatus,
  type UpdateListingInput,
  type UserRole,
} from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import { riskScore, scanForRisk } from '../moderation/risk-scan.js';
import { getQuota, quotaExhausted } from './quota.js';

export interface ListingDeps {
  prisma: PrismaClient;
  now: () => Date;
}

async function resolveReferences(prisma: PrismaClient, categorySlug: string, citySlug: string) {
  const [category, city] = await Promise.all([
    prisma.category.findUnique({ where: { slug: categorySlug } }),
    prisma.city.findUnique({ where: { slug: citySlug } }),
  ]);

  if (!category) throw HttpError.badRequest('UNKNOWN_CATEGORY', 'Catégorie inconnue');
  if (!city) throw HttpError.badRequest('UNKNOWN_CITY', 'Ville inconnue');

  return { category, city };
}

/**
 * Les images sont téléversées avant la création de l'annonce. On vérifie donc
 * qu'elles appartiennent bien à l'appelant et qu'elles ne sont pas déjà
 * rattachées ailleurs : sans ce contrôle, connaître un identifiant suffirait à
 * s'approprier la photo d'autrui.
 */
async function claimImages(
  prisma: PrismaClient,
  imageIds: string[],
  userId: string,
  listingId: string | null,
): Promise<void> {
  const images = await prisma.listingImage.findMany({ where: { id: { in: imageIds } } });

  if (images.length !== imageIds.length) {
    throw HttpError.badRequest('UNKNOWN_IMAGE', 'Une des photos est introuvable');
  }

  for (const image of images) {
    if (image.uploadedById !== userId) {
      throw HttpError.forbidden('IMAGE_NOT_OWNED', 'Une des photos ne vous appartient pas');
    }
    if (image.listingId && image.listingId !== listingId) {
      throw HttpError.conflict('IMAGE_ALREADY_USED', 'Une des photos est déjà utilisée');
    }
  }
}

async function applyImageOrder(
  prisma: PrismaClient,
  listingId: string,
  imageIds: string[],
): Promise<void> {
  // Les photos retirées redeviennent orphelines : la tâche planifiée les
  // supprimera, plutôt que de les effacer ici et de perdre un retour arrière.
  await prisma.listingImage.updateMany({
    where: { listingId, id: { notIn: imageIds } },
    data: { listingId: null, position: 0 },
  });

  for (const [position, id] of imageIds.entries()) {
    await prisma.listingImage.update({ where: { id }, data: { listingId, position } });
  }
}

/** Enregistre ce que le filtre automatique a repéré ; il signale, il ne décide pas. */
async function recordRiskFlags(
  prisma: PrismaClient,
  listingId: string,
  title: string,
  description: string,
): Promise<number> {
  await prisma.moderationFlag.deleteMany({ where: { listingId } });

  const matches = scanForRisk(title, description);
  if (matches.length > 0) {
    await prisma.moderationFlag.createMany({
      data: matches.map((m) => ({
        listingId,
        rule: m.rule,
        matchedOn: m.matchedOn,
        severity: m.severity,
      })),
    });
  }

  return riskScore(matches);
}

export async function createListing(
  deps: ListingDeps,
  userId: string,
  role: UserRole,
  input: CreateListingInput,
  options: { publish: boolean },
): Promise<Listing> {
  const now = deps.now();
  const { category, city } = await resolveReferences(
    deps.prisma,
    input.categorySlug,
    input.citySlug,
  );

  if (options.publish) {
    const quota = await getQuota(deps.prisma, userId, role, now);
    if (quotaExhausted(quota)) {
      throw new HttpError(
        403,
        'QUOTA_EXCEEDED',
        `Vous avez atteint votre quota de ${quota.limit} annonces publiées ce mois-ci. ` +
          'Il se réinitialise le 1er du mois, ou passez en Pro pour publier sans limite.',
      );
    }
  }

  await claimImages(deps.prisma, input.imageIds, userId, null);

  const seller = await deps.prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const listing = await deps.prisma.listing.create({
    data: {
      slug: slugify(input.title),
      title: input.title,
      description: input.description,
      price: input.price,
      priceUnit: input.priceUnit,
      condition: input.condition,
      // Une annonce ne passe jamais directement en ligne : elle est modérée.
      status: options.publish ? 'PENDING' : 'DRAFT',
      sellerId: userId,
      sellerIsPro: seller.role === 'PRO',
      categoryId: category.id,
      cityId: city.id,
      neighbourhood: input.neighbourhood ?? null,
      createdAt: now,
    },
  });

  await applyImageOrder(deps.prisma, listing.id, input.imageIds);
  await recordRiskFlags(deps.prisma, listing.id, input.title, input.description);

  return listing;
}

export async function updateListing(
  deps: ListingDeps,
  listingId: string,
  userId: string,
  input: UpdateListingInput,
): Promise<Listing> {
  const listing = await deps.prisma.listing.findUnique({ where: { id: listingId } });

  if (!listing || listing.deletedAt) throw HttpError.notFound();
  // Contrôle d'accès à la ressource, pas seulement à la route.
  if (listing.sellerId !== userId) throw HttpError.forbidden();
  if (listing.status === 'DELETED')
    throw HttpError.conflict('LISTING_DELETED', 'Annonce supprimée');

  const data: Record<string, unknown> = {};

  if (input.categorySlug || input.citySlug) {
    const { category, city } = await resolveReferences(
      deps.prisma,
      input.categorySlug ??
        (await deps.prisma.category.findUniqueOrThrow({ where: { id: listing.categoryId } })).slug,
      input.citySlug ??
        (await deps.prisma.city.findUniqueOrThrow({ where: { id: listing.cityId } })).slug,
    );
    data.categoryId = category.id;
    data.cityId = city.id;
  }

  if (input.title !== undefined) {
    data.title = input.title;
    data.slug = slugify(input.title);
  }
  if (input.description !== undefined) data.description = input.description;
  if (input.price !== undefined) data.price = input.price;
  if (input.priceUnit !== undefined) data.priceUnit = input.priceUnit;
  if (input.condition !== undefined) data.condition = input.condition;
  if (input.neighbourhood !== undefined) data.neighbourhood = input.neighbourhood;

  // Modifier une annonce en ligne la renvoie en modération : sinon il suffirait
  // de publier une annonce anodine puis d'en changer le contenu.
  const contentChanged =
    input.title !== undefined || input.description !== undefined || input.price !== undefined;

  if (contentChanged && listing.status === 'PUBLISHED') {
    data.status = 'PENDING';
    data.publishedAt = null;
  }

  if (input.imageIds) {
    await claimImages(deps.prisma, input.imageIds, userId, listingId);
  }

  const updated = await deps.prisma.listing.update({ where: { id: listingId }, data });

  if (input.imageIds) await applyImageOrder(deps.prisma, listingId, input.imageIds);
  if (contentChanged) {
    await recordRiskFlags(deps.prisma, listingId, updated.title, updated.description);
  }

  return updated;
}

export async function transitionListing(
  deps: ListingDeps,
  listingId: string,
  userId: string,
  role: UserRole,
  target: ListingStatus,
): Promise<Listing> {
  const now = deps.now();
  const listing = await deps.prisma.listing.findUnique({ where: { id: listingId } });

  if (!listing || listing.deletedAt) throw HttpError.notFound();
  if (listing.sellerId !== userId) throw HttpError.forbidden();

  if (!canTransition(listing.status, target)) {
    throw HttpError.conflict(
      'INVALID_TRANSITION',
      `Passage impossible de ${listing.status} à ${target}`,
    );
  }

  const data: Record<string, unknown> = { status: target };

  if (target === 'PENDING') {
    const quota = await getQuota(deps.prisma, userId, role, now);
    if (quotaExhausted(quota)) {
      throw new HttpError(
        403,
        'QUOTA_EXCEEDED',
        `Quota mensuel atteint (${quota.limit} annonces publiées).`,
      );
    }
    // Une annonce expirée que l'on remet en ligne repart pour un cycle complet.
    data.renewedAt = listing.status === 'EXPIRED' ? now : listing.renewedAt;
  }

  if (target === 'SOLD') data.soldAt = now;
  if (target === 'DELETED') {
    data.deletedAt = now;
    data.publishedAt = null;
  }

  return deps.prisma.listing.update({ where: { id: listingId }, data });
}

/** Renouvellement : repousse l'échéance sans repasser par la modération. */
export async function renewListing(
  deps: ListingDeps,
  listingId: string,
  userId: string,
): Promise<Listing> {
  const now = deps.now();
  const listing = await deps.prisma.listing.findUnique({ where: { id: listingId } });

  if (!listing || listing.deletedAt) throw HttpError.notFound();
  if (listing.sellerId !== userId) throw HttpError.forbidden();
  if (listing.status !== 'PUBLISHED') {
    throw HttpError.conflict('NOT_PUBLISHED', 'Seule une annonce en ligne peut être renouvelée');
  }

  // Renouveler trop tôt permettrait de garder une annonce en tête de liste
  // indéfiniment : la fenêtre s'ouvre une semaine avant l'expiration.
  const windowOpensAt = listing.expiresAt
    ? addDays(listing.expiresAt, -LISTING_LIMITS.renewalWindowDays)
    : now;

  if (now < windowOpensAt) {
    throw HttpError.conflict(
      'TOO_EARLY',
      `Le renouvellement sera possible à partir du ${windowOpensAt.toISOString().slice(0, 10)}`,
    );
  }

  return deps.prisma.listing.update({
    where: { id: listingId },
    data: {
      renewedAt: now,
      expiresAt: addDays(now, LISTING_LIMITS.publishedLifetimeDays),
    },
  });
}

/**
 * Compteur de vues dédoublonné sur 24 heures. L'empreinte combine l'annonce,
 * le jour et un identifiant de session ; elle n'est pas réversible et ne
 * conserve aucune adresse IP complète.
 */
export async function recordView(
  prisma: PrismaClient,
  listingId: string,
  now: Date,
  visitor: { sessionId?: string | undefined; ip?: string | undefined },
): Promise<void> {
  const day = now.toISOString().slice(0, 10);
  const seed = visitor.sessionId ?? truncateIp(visitor.ip) ?? 'anonyme';
  const visitorHash = createHash('sha256').update(`${listingId}:${day}:${seed}`).digest('hex');

  try {
    await prisma.listingView.create({ data: { listingId, visitorHash, viewedAt: now } });
    await prisma.listing.update({
      where: { id: listingId },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Contrainte d'unicité : ce visiteur a déjà été compté aujourd'hui.
  }
}
