import type { PrismaClient } from '@prisma/client';
import { LISTING_LIMITS, addDays, slugify } from '@inbox/shared';
import { riskScore, scanForRisk } from '../../src/modules/moderation/risk-scan.js';
import { DEMO_LISTINGS, PENDING_LISTINGS, type ListingSeed } from './listings-data.js';
import { generateDemoImage, writeDemoImage } from './images.js';
import type { SeedAccounts } from './users.js';

/**
 * Les photos de démonstration ne sont pas téléversées sur Cloudinary : le seed
 * doit tourner sans compte tiers. On génère de vraies images sobres sur le
 * disque local, et le front affiche son visuel de remplacement là où le
 * fichier n'existe pas (hébergement sans disque persistant).
 */
async function demoImages(listingSlug: string, title: string, count: number, uploadedById: string) {
  const images = [];

  for (let index = 0; index < count; index += 1) {
    const publicId = `demo/${listingSlug}-${index + 1}`;
    const data = await generateDemoImage(title, index + 1, count);
    await writeDemoImage(publicId, data);

    images.push({
      publicId,
      uploadedById,
      width: 1200,
      height: 900,
      bytes: data.byteLength,
      format: 'webp',
      position: index,
    });
  }

  return images;
}

async function createListing(
  prisma: PrismaClient,
  seed: ListingSeed,
  accounts: SeedAccounts,
  now: Date,
  options: { status: 'PUBLISHED' | 'PENDING'; ageDays: number },
) {
  const [category, city] = await Promise.all([
    prisma.category.findUniqueOrThrow({ where: { slug: seed.category } }),
    prisma.city.findUniqueOrThrow({ where: { slug: seed.city } }),
  ]);

  const seller = seed.owner === 'pro' ? accounts.pro : accounts.user;
  const slug = slugify(seed.title);
  const createdAt = addDays(now, -options.ageDays);
  const publishedAt = options.status === 'PUBLISHED' ? createdAt : null;

  const listing = await prisma.listing.create({
    data: {
      slug,
      title: seed.title,
      description: seed.description,
      price: seed.price,
      priceUnit: seed.priceUnit ?? 'NONE',
      condition: seed.condition,
      status: options.status,
      sellerId: seller.id,
      sellerIsPro: seller.role === 'PRO',
      categoryId: category.id,
      cityId: city.id,
      neighbourhood: seed.neighbourhood,
      createdAt,
      publishedAt,
      expiresAt: publishedAt ? addDays(publishedAt, LISTING_LIMITS.publishedLifetimeDays) : null,
      // Chiffres plausibles pour que les tris et les statistiques aient du sens.
      viewCount: options.status === 'PUBLISHED' ? 20 + ((seed.title.length * 7) % 400) : 0,
      images: { create: await demoImages(slug, seed.title, seed.images, seller.id) },
    },
  });

  // Le repérage automatique tourne pour de vrai : les annonces frauduleuses du
  // jeu de démonstration doivent réellement remonter en tête de file.
  const matches = scanForRisk(seed.title, seed.description);
  if (matches.length > 0) {
    await prisma.moderationFlag.createMany({
      data: matches.map((m) => ({
        listingId: listing.id,
        rule: m.rule,
        matchedOn: m.matchedOn,
        severity: m.severity,
      })),
    });
  }

  return { listing, riskScore: riskScore(matches) };
}

export async function seedListings(
  prisma: PrismaClient,
  accounts: SeedAccounts,
  now: Date,
): Promise<{ published: number; pending: number; flagged: number }> {
  let flagged = 0;

  for (const [index, seed] of DEMO_LISTINGS.entries()) {
    // Étalement sur deux mois : la page d'accueil montre un flux crédible.
    const result = await createListing(prisma, seed, accounts, now, {
      status: 'PUBLISHED',
      ageDays: (index * 37) % 55,
    });
    if (result.riskScore > 0) flagged += 1;
  }

  for (const [index, seed] of PENDING_LISTINGS.entries()) {
    const result = await createListing(prisma, seed, accounts, now, {
      status: 'PENDING',
      ageDays: index % 3,
    });
    if (result.riskScore > 0) flagged += 1;
  }

  // Compteurs de favoris cohérents : le compte particulier suit quelques
  // annonces du compte professionnel.
  const proListings = await prisma.listing.findMany({
    where: { sellerId: accounts.pro.id, status: 'PUBLISHED' },
    select: { id: true },
    take: 5,
  });
  for (const listing of proListings) {
    await prisma.favorite.create({ data: { userId: accounts.user.id, listingId: listing.id } });
  }
  await prisma.listing.updateMany({
    where: { id: { in: proListings.map((l) => l.id) } },
    data: { favoriteCount: 1 },
  });

  return {
    published: DEMO_LISTINGS.length,
    pending: PENDING_LISTINGS.length,
    flagged,
  };
}
