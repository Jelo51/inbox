import { z } from 'zod';
import {
  REJECTION_REASONS,
  REPORT_STATUSES,
  REPORT_TARGETS,
  USER_ROLES,
} from '../constants/enums.js';
import { cursorPaginationSchema, idSchema } from './common.js';

export const createReportSchema = z
  .object({
    target: z.enum(REPORT_TARGETS),
    targetId: idSchema,
    reason: z.enum([
      'PROHIBITED_ITEM',
      'SCAM',
      'COUNTERFEIT',
      'WRONG_CATEGORY',
      'OFFENSIVE',
      'HARASSMENT',
      'SPAM',
      'OTHER',
    ]),
    comment: z.string().trim().max(1000).optional(),
    /**
     * Signalement d'une conversation : le serveur ne peut pas lire les messages,
     * c'est donc l'utilisateur qui déchiffre sur son appareil et transmet le clair,
     * avec son accord explicite. Sans ce consentement, rien n'est transmis.
     */
    disclosedMessages: z
      .array(
        z.object({
          messageId: idSchema,
          sentAt: z.string().datetime(),
          fromMe: z.boolean(),
          plaintext: z.string().max(16_000),
        }),
      )
      .max(200)
      .optional(),
    disclosureConsent: z.boolean().optional(),
  })
  .refine((v) => !v.disclosedMessages?.length || v.disclosureConsent === true, {
    message: 'La transmission des messages requiert votre accord explicite',
    path: ['disclosureConsent'],
  });
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const moderateListingSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('APPROVE'), note: z.string().trim().max(500).optional() }),
  z.object({
    decision: z.literal('REJECT'),
    /** Le motif est obligatoire : il est envoyé à l'auteur par e-mail. */
    reason: z.enum(REJECTION_REASONS),
    note: z.string().trim().max(500).optional(),
  }),
]);
export type ModerateListingInput = z.infer<typeof moderateListingSchema>;

export const resolveReportSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  note: z.string().trim().max(1000).optional(),
});

export const listReportsSchema = cursorPaginationSchema.extend({
  status: z.enum(REPORT_STATUSES).optional(),
  target: z.enum(REPORT_TARGETS).optional(),
});

export const suspendUserSchema = z.object({
  /** Suspension temporaire ; au-delà de 365 jours, utiliser le bannissement. */
  days: z.number().int().min(1).max(365),
  reason: z.string().trim().min(5).max(500),
});

export const banUserSchema = z.object({ reason: z.string().trim().min(5).max(500) });

export const changeRoleSchema = z.object({
  role: z.enum(USER_ROLES),
  reason: z.string().trim().min(5).max(500),
});
