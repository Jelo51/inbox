import { z } from 'zod';
import { AUTH_LIMITS } from '../constants/limits.js';
import { isValidCameroonMobile } from '../utils/phone.js';
import { emailSchema, localeSchema } from './common.js';

/**
 * Mot de passe : longueur d'abord, puis diversité. Une phrase de passe longue
 * vaut mieux qu'un mot court truffé de symboles ; d'où le minimum à 12.
 */
export const passwordSchema = z
  .string()
  .min(AUTH_LIMITS.passwordMin, `Au moins ${AUTH_LIMITS.passwordMin} caractères`)
  .max(AUTH_LIMITS.passwordMax)
  .refine((v) => /[a-zà-ÿ]/.test(v), 'Au moins une minuscule')
  .refine((v) => /[A-ZÀ-Ý]/.test(v), 'Au moins une majuscule')
  .refine((v) => /\d/.test(v), 'Au moins un chiffre');

export const phoneSchema = z
  .string()
  .trim()
  .refine(isValidCameroonMobile, 'Numéro camerounais attendu, au format +237 6XX XX XX XX');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Au moins 2 caractères')
  .max(50)
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u, 'Caractères non autorisés');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  phone: phoneSchema.optional(),
  locale: localeSchema.default('fr'),
  /** Déclaration de majorité : case non précochée, exigée explicitement. */
  isAdult: z.literal(true, {
    errorMap: () => ({ message: `Vous devez avoir ${AUTH_LIMITS.minimumAgeYears} ans ou plus` }),
  }),
  /** Acceptation des CGU et de la politique de confidentialité, versionnée. */
  acceptedLegalVersions: z
    .object({
      CGU: z.string().min(1),
      CONFIDENTIALITE: z.string().min(1),
    })
    .strict(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis').max(AUTH_LIMITS.passwordMax),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const requestPasswordResetSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(AUTH_LIMITS.passwordMax),
  newPassword: passwordSchema,
});

export const changeEmailSchema = z.object({
  newEmail: emailSchema,
  currentPassword: z.string().min(1).max(AUTH_LIMITS.passwordMax),
});

/** Réacceptation d'une nouvelle version d'un document légal. */
export const acceptLegalSchema = z.object({
  acceptances: z
    .array(z.object({ type: z.string().min(1), version: z.string().min(1) }))
    .min(1)
    .max(10),
});
