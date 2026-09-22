/**
 * Énumérations métier, dupliquées volontairement depuis le schéma Prisma.
 * Le client ne doit pas dépendre de @prisma/client ; un test d'intégrité
 * (apps/api/tests/unit/enums-sync.test.ts) vérifie que les deux restent alignés.
 */

export const USER_ROLES = ['USER', 'PRO', 'MODERATOR', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const LISTING_STATUSES = [
  'DRAFT',
  'PENDING',
  'PUBLISHED',
  'REJECTED',
  'EXPIRED',
  'SOLD',
  'DELETED',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_CONDITIONS = [
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'FAIR',
  'FOR_PARTS',
  'NOT_APPLICABLE',
] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

/** Unité facultative affichée après le prix (« 385 000 FCFA /mois »). */
export const PRICE_UNITS = ['NONE', 'PER_MONTH', 'PER_DAY', 'PER_HOUR', 'PER_SESSION'] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const REPORT_TARGETS = ['LISTING', 'USER', 'CONVERSATION'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  'PENDING',
  'ACTIVE',
  'CANCELLED',
  'EXPIRED',
  'PAYMENT_FAILED',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * `MOCK` est le fournisseur de démonstration utilisé tant qu'aucun compte
 * Maviance ni Stripe n'est ouvert. Il n'est jamais accepté en production.
 */
export const PAYMENT_PROVIDERS = ['MOCK', 'MAVIANCE', 'STRIPE'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_METHODS = ['MTN_MOMO', 'ORANGE_MONEY', 'CARD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const LEGAL_DOCUMENT_TYPES = [
  'MENTIONS_LEGALES',
  'CGU',
  'CGV',
  'CONFIDENTIALITE',
  'COOKIES',
  'REGLES_PUBLICATION',
  'CONSEILS_SECURITE',
] as const;
export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

/** Documents dont l'acceptation explicite est exigée à l'inscription. */
export const LEGAL_DOCUMENTS_REQUIRING_ACCEPTANCE = ['CGU', 'CONFIDENTIALITE'] as const;

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** En cas de divergence entre les versions linguistiques, le français fait foi. */
export const AUTHORITATIVE_LOCALE: Locale = 'fr';

export const AUDIT_ACTIONS = [
  'LISTING_APPROVED',
  'LISTING_REJECTED',
  'LISTING_DELETED',
  'USER_SUSPENDED',
  'USER_UNSUSPENDED',
  'USER_BANNED',
  'USER_ROLE_CHANGED',
  'REPORT_RESOLVED',
  'REPORT_DISMISSED',
  'LEGAL_DOCUMENT_PUBLISHED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Motifs de refus proposés au modérateur ; le motif est obligatoire. */
export const REJECTION_REASONS = [
  'PROHIBITED_ITEM',
  'COUNTERFEIT',
  'MISLEADING_PRICE',
  'WRONG_CATEGORY',
  'POOR_QUALITY_PHOTOS',
  'DUPLICATE',
  'CONTACT_IN_DESCRIPTION',
  'SUSPECTED_SCAM',
  'ADULT_CONTENT',
  'OTHER',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];
