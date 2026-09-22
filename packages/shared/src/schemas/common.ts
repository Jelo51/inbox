import { z } from 'zod';
import { LOCALES } from '../constants/enums.js';
import { PAGINATION } from '../constants/limits.js';

/** Identifiants Prisma : cuid v2. */
export const idSchema = z
  .string()
  .min(20)
  .max(40)
  .regex(/^[a-z0-9]+$/, 'Identifiant invalide');

export const localeSchema = z.enum(LOCALES);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5)
  .max(254)
  .email('Adresse e-mail invalide');

/** Pagination par curseur : le curseur est opaque pour le client. */
export const cursorPaginationSchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
});
export type CursorPagination = z.infer<typeof cursorPaginationSchema>;

export const okSchema = z.object({ ok: z.literal(true) });

/** Forme unique des erreurs de l'API : { error: { code, message, details? } }. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.array(z.string())).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    total: z.number().int().nonnegative().optional(),
  });
}
