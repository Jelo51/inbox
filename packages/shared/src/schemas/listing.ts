import { z } from 'zod';
import { LISTING_CONDITIONS, LISTING_STATUSES, PRICE_UNITS } from '../constants/enums.js';
import { LISTING_LIMITS } from '../constants/limits.js';
import { CATEGORY_SLUGS, CITY_SLUGS } from '../constants/catalog.js';
import { cursorPaginationSchema, idSchema } from './common.js';

const titleSchema = z
  .string()
  .trim()
  .min(LISTING_LIMITS.titleMin, `Au moins ${LISTING_LIMITS.titleMin} caractères`)
  .max(LISTING_LIMITS.titleMax);

const descriptionSchema = z
  .string()
  .trim()
  .min(LISTING_LIMITS.descriptionMin, `Au moins ${LISTING_LIMITS.descriptionMin} caractères`)
  .max(LISTING_LIMITS.descriptionMax);

/** Le prix est un entier de francs CFA ; le FCFA n'a pas de sous-unité. */
const priceSchema = z.coerce
  .number()
  .int('Le prix doit être un nombre entier de francs CFA')
  .min(LISTING_LIMITS.priceMin)
  .max(LISTING_LIMITS.priceMax);

export const createListingSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  price: priceSchema,
  priceUnit: z.enum(PRICE_UNITS).default('NONE'),
  categorySlug: z.enum(CATEGORY_SLUGS as [string, ...string[]]),
  citySlug: z.enum(CITY_SLUGS as [string, ...string[]]),
  neighbourhood: z.string().trim().max(LISTING_LIMITS.neighbourhoodMax).optional(),
  condition: z.enum(LISTING_CONDITIONS).default('GOOD'),
  /** Identifiants d'images déjà téléversées et validées par l'API. */
  imageIds: z
    .array(idSchema)
    .min(LISTING_LIMITS.imagesMin, 'Au moins une photo')
    .max(LISTING_LIMITS.imagesMax, `Huit photos au maximum`),
});
export type CreateListingInput = z.infer<typeof createListingSchema>;

export const updateListingSchema = createListingSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Aucune modification fournie');
export type UpdateListingInput = z.infer<typeof updateListingSchema>;

export const listingSortSchema = z.enum(['recent', 'price_asc', 'price_desc']).default('recent');
export type ListingSort = z.infer<typeof listingSortSchema>;

export const searchListingsSchema = cursorPaginationSchema
  .extend({
    q: z.string().trim().max(120).optional(),
    category: z.enum(CATEGORY_SLUGS as [string, ...string[]]).optional(),
    city: z.enum(CITY_SLUGS as [string, ...string[]]).optional(),
    priceMin: z.coerce.number().int().min(0).optional(),
    priceMax: z.coerce.number().int().min(0).optional(),
    condition: z.enum(LISTING_CONDITIONS).optional(),
    sort: listingSortSchema,
  })
  .refine((v) => v.priceMin === undefined || v.priceMax === undefined || v.priceMin <= v.priceMax, {
    message: 'Le prix minimum dépasse le prix maximum',
    path: ['priceMin'],
  });
export type SearchListingsInput = z.infer<typeof searchListingsSchema>;

export const listingStatusSchema = z.enum(LISTING_STATUSES);

/** Transitions autorisées du cycle de vie. Le serveur les fait respecter. */
export const LISTING_TRANSITIONS: Record<
  (typeof LISTING_STATUSES)[number],
  readonly (typeof LISTING_STATUSES)[number][]
> = {
  DRAFT: ['PENDING', 'DELETED'],
  PENDING: ['PUBLISHED', 'REJECTED', 'DELETED'],
  PUBLISHED: ['SOLD', 'EXPIRED', 'DELETED', 'PENDING'],
  REJECTED: ['DRAFT', 'PENDING', 'DELETED'],
  EXPIRED: ['PENDING', 'DELETED'],
  SOLD: ['DELETED'],
  DELETED: [],
};

export function canTransition(
  from: (typeof LISTING_STATUSES)[number],
  to: (typeof LISTING_STATUSES)[number],
): boolean {
  return LISTING_TRANSITIONS[from].includes(to);
}
