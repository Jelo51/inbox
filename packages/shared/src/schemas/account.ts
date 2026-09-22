import { z } from 'zod';
import { LEGAL_DOCUMENT_TYPES } from '../constants/enums.js';
import { displayNameSchema, phoneSchema } from './auth.js';
import { localeSchema } from './common.js';
import { CITY_SLUGS } from '../constants/catalog.js';

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: z.string().trim().max(500).optional(),
  citySlug: z.enum(CITY_SLUGS as [string, ...string[]]).optional(),
  phone: phoneSchema.nullable().optional(),
  locale: localeSchema.optional(),
});

export const notificationPreferenceSchema = z.object({
  emailOnNewMessage: z.boolean(),
  emailOnListingApproved: z.boolean(),
  emailOnListingRejected: z.boolean(),
  emailOnListingExpiring: z.boolean(),
  emailOnSubscriptionRenewal: z.boolean(),
  emailProductNews: z.boolean(),
});
export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;

/** Suppression de compte en libre-service : confirmation par mot de passe. */
export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirmation: z.literal('SUPPRIMER', {
    errorMap: () => ({ message: 'Saisissez SUPPRIMER pour confirmer' }),
  }),
});

export const legalDocumentTypeSchema = z.enum(LEGAL_DOCUMENT_TYPES);

/**
 * Consentement aux traceurs. Par défaut, seuls les cookies strictement
 * nécessaires sont posés ; la mesure d'audience retenue (Umami auto-hébergé)
 * n'utilise aucun cookie, donc `analytics` reste à false tant qu'aucun outil
 * à cookie n'est ajouté.
 */
export const consentSchema = z.object({
  analytics: z.boolean().default(false),
  policyVersion: z.string().min(1).max(20),
});
export type ConsentInput = z.infer<typeof consentSchema>;
