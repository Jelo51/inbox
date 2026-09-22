import { z } from 'zod';
import { PAYMENT_METHODS, PAYMENT_PROVIDERS } from '../constants/enums.js';
import { phoneSchema } from './auth.js';

/**
 * Le montant et la périodicité viennent de la table `Plan`, jamais du client :
 * une requête ne transporte que le choix du plan et du moyen de paiement.
 */
export const startSubscriptionSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('MTN_MOMO'),
    planCode: z.string().min(2).max(40),
    /** Numéro depuis lequel le paiement Mobile Money sera confirmé. */
    payerPhone: phoneSchema,
  }),
  z.object({
    method: z.literal('ORANGE_MONEY'),
    planCode: z.string().min(2).max(40),
    payerPhone: phoneSchema,
  }),
  z.object({
    method: z.literal('CARD'),
    planCode: z.string().min(2).max(40),
  }),
]);
export type StartSubscriptionInput = z.infer<typeof startSubscriptionSchema>;

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const paymentProviderSchema = z.enum(PAYMENT_PROVIDERS);

export const cancelSubscriptionSchema = z.object({
  /** Facultatif, sert uniquement aux statistiques internes. */
  reason: z.string().trim().max(500).optional(),
});

/**
 * Confirmation de démonstration du fournisseur `MOCK`. Elle n'existe que hors
 * production : le garde `assertNotProduction` de l'API la refuse autrement.
 */
export const mockPaymentConfirmSchema = z.object({
  reference: z.string().min(6).max(64),
  outcome: z.enum(['SUCCEEDED', 'FAILED']),
});
