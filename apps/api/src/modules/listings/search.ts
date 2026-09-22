import { Prisma, type PrismaClient } from '@prisma/client';
import type { SearchListingsInput } from '@inbox/shared';

export interface SearchRow {
  id: string;
  slug: string;
  title: string;
  price: number;
  priceUnit: string;
  condition: string;
  sellerIsPro: boolean;
  publishedAt: Date;
  viewCount: number;
  cityName: string;
  citySlug: string;
  categorySlug: string;
  categoryNameFr: string;
  categoryNameEn: string;
  neighbourhood: string | null;
  imagePublicId: string | null;
  rank: number;
}

export interface SearchResult {
  items: SearchRow[];
  nextCursor: string | null;
}

/**
 * Le curseur encode la position exacte dans le tri courant. Un simple décalage
 * (`OFFSET`) ferait sauter ou répéter des annonces dès qu'une nouvelle est
 * publiée pendant la navigation, ce qui arrive en permanence.
 */
interface Cursor {
  rank?: number;
  price?: number;
  publishedAt: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
    return typeof parsed?.id === 'string' && typeof parsed?.publishedAt === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/**
 * Recherche d'annonces publiées.
 *
 * Écrite en SQL plutôt qu'avec le constructeur de requêtes Prisma : le
 * classement plein texte (`ts_rank`) et le tri composite « pertinence, puis
 * comptes PRO, puis date » ne s'expriment pas dans l'API de Prisma. Tous les
 * paramètres passent par `Prisma.sql`, donc rien n'est concaténé à la main.
 */
export async function searchListings(
  prisma: PrismaClient,
  input: SearchListingsInput,
): Promise<SearchResult> {
  const cursor = decodeCursor(input.cursor);
  const limit = input.limit;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`l."status" = 'PUBLISHED'`,
    Prisma.sql`l."deletedAt" IS NULL`,
  ];

  const hasQuery = Boolean(input.q?.trim());
  const query = input.q?.trim() ?? '';

  if (hasQuery) {
    conditions.push(
      Prisma.sql`l."searchVector" @@ websearch_to_tsquery('french', inbox_unaccent(${query}))`,
    );
  }
  if (input.category) conditions.push(Prisma.sql`cat."slug" = ${input.category}`);
  if (input.city) conditions.push(Prisma.sql`city."slug" = ${input.city}`);
  if (input.condition) conditions.push(Prisma.sql`l."condition"::text = ${input.condition}`);
  if (input.priceMin !== undefined) conditions.push(Prisma.sql`l."price" >= ${input.priceMin}`);
  if (input.priceMax !== undefined) conditions.push(Prisma.sql`l."price" <= ${input.priceMax}`);

  const rankExpression = hasQuery
    ? Prisma.sql`ts_rank(l."searchVector", websearch_to_tsquery('french', inbox_unaccent(${query})))`
    : Prisma.sql`0::real`;

  // À pertinence égale, les annonces PRO remontent : c'est l'avantage vendu
  // avec l'abonnement. Elles ne passent jamais devant une annonce plus
  // pertinente, seulement devant une annonce aussi pertinente.
  const orderBy =
    input.sort === 'price_asc'
      ? Prisma.sql`l."price" ASC, l."publishedAt" DESC, l."id" DESC`
      : input.sort === 'price_desc'
        ? Prisma.sql`l."price" DESC, l."publishedAt" DESC, l."id" DESC`
        : hasQuery
          ? Prisma.sql`rank DESC, l."sellerIsPro" DESC, l."publishedAt" DESC, l."id" DESC`
          : Prisma.sql`l."sellerIsPro" DESC, l."publishedAt" DESC, l."id" DESC`;

  if (cursor) {
    if (input.sort === 'price_asc') {
      conditions.push(
        Prisma.sql`(l."price", l."publishedAt", l."id") > (${cursor.price ?? 0}, ${new Date(cursor.publishedAt)}, ${cursor.id})`,
      );
    } else if (input.sort === 'price_desc') {
      conditions.push(
        Prisma.sql`(l."price", l."publishedAt", l."id") < (${cursor.price ?? 0}, ${new Date(cursor.publishedAt)}, ${cursor.id})`,
      );
    } else {
      conditions.push(
        Prisma.sql`(l."publishedAt", l."id") < (${new Date(cursor.publishedAt)}, ${cursor.id})`,
      );
    }
  }

  const where = Prisma.join(conditions, ' AND ');

  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT
      l."id",
      l."slug",
      l."title",
      l."price",
      l."priceUnit"::text AS "priceUnit",
      l."condition"::text AS "condition",
      l."sellerIsPro",
      l."publishedAt",
      l."viewCount",
      l."neighbourhood",
      city."name"  AS "cityName",
      city."slug"  AS "citySlug",
      cat."slug"   AS "categorySlug",
      cat."nameFr" AS "categoryNameFr",
      cat."nameEn" AS "categoryNameEn",
      (
        SELECT img."publicId" FROM "ListingImage" img
        WHERE img."listingId" = l."id"
        ORDER BY img."position" ASC
        LIMIT 1
      ) AS "imagePublicId",
      ${rankExpression} AS rank
    FROM "Listing" l
    JOIN "City" city ON city."id" = l."cityId"
    JOIN "Category" cat ON cat."id" = l."categoryId"
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT ${limit + 1}
  `;

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items,
    nextCursor:
      hasMore && last
        ? encodeCursor({
            id: last.id,
            publishedAt: last.publishedAt.toISOString(),
            price: last.price,
            rank: last.rank,
          })
        : null,
  };
}

/** Compte total, pour l'affichage « N annonces ». Requête séparée : elle coûte cher. */
export async function countListings(
  prisma: PrismaClient,
  input: SearchListingsInput,
): Promise<number> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`l."status" = 'PUBLISHED'`,
    Prisma.sql`l."deletedAt" IS NULL`,
  ];

  const query = input.q?.trim() ?? '';
  if (query) {
    conditions.push(
      Prisma.sql`l."searchVector" @@ websearch_to_tsquery('french', inbox_unaccent(${query}))`,
    );
  }
  if (input.category) conditions.push(Prisma.sql`cat."slug" = ${input.category}`);
  if (input.city) conditions.push(Prisma.sql`city."slug" = ${input.city}`);
  if (input.condition) conditions.push(Prisma.sql`l."condition"::text = ${input.condition}`);
  if (input.priceMin !== undefined) conditions.push(Prisma.sql`l."price" >= ${input.priceMin}`);
  if (input.priceMax !== undefined) conditions.push(Prisma.sql`l."price" <= ${input.priceMax}`);

  const rows = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT count(*) AS total
    FROM "Listing" l
    JOIN "City" city ON city."id" = l."cityId"
    JOIN "Category" cat ON cat."id" = l."categoryId"
    WHERE ${Prisma.join(conditions, ' AND ')}
  `;

  return Number(rows[0]?.total ?? 0);
}
