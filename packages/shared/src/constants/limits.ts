/**
 * Toutes les limites métier en un seul endroit. Le serveur fait autorité :
 * le client s'en sert uniquement pour afficher l'information à l'utilisateur.
 */

export const LISTING_LIMITS = {
  titleMin: 5,
  titleMax: 90,
  descriptionMin: 20,
  descriptionMax: 4000,
  /** Prix en francs CFA, entier. 0 est autorisé (« donné », « à débattre »). */
  priceMin: 0,
  priceMax: 2_000_000_000,
  imagesMin: 1,
  imagesMax: 8,
  imageMaxBytes: 8 * 1024 * 1024,
  neighbourhoodMax: 60,
  /** Durée de vie d'une annonce publiée, en jours. Renouvelable. */
  publishedLifetimeDays: 60,
  /** Fenêtre de renouvellement avant expiration, en jours. */
  renewalWindowDays: 7,
} as const;

export const QUOTA = {
  /** Annonces publiées par mois calendaire pour un compte USER. */
  freeListingsPerMonth: 10,
  /** Un compte PRO n'est pas plafonné. */
  proListingsPerMonth: null,
  /** Fuseau de référence pour la bascule mensuelle du quota. */
  timezone: 'Africa/Douala',
} as const;

export const MESSAGE_LIMITS = {
  /** Taille du chiffré transporté (base64), et non du clair. */
  ciphertextMaxBytes: 16 * 1024,
  nonceBytes: 24,
  publicKeyBytes: 32,
} as const;

export const AUTH_LIMITS = {
  passwordMin: 12,
  passwordMax: 128,
  /** Durée de vie du jeton d'accès. */
  accessTokenTtlSeconds: 15 * 60,
  /** Durée de vie du jeton de rafraîchissement (cookie httpOnly). */
  refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
  emailVerificationTtlSeconds: 24 * 60 * 60,
  passwordResetTtlSeconds: 30 * 60,
  emailChangeTtlSeconds: 60 * 60,
  minimumAgeYears: 18,
} as const;

/** Limitation de débit : { requêtes, fenêtre en secondes }. */
export const RATE_LIMITS = {
  login: { points: 5, windowSeconds: 15 * 60 },
  register: { points: 3, windowSeconds: 60 * 60 },
  passwordReset: { points: 3, windowSeconds: 60 * 60 },
  emailVerificationResend: { points: 3, windowSeconds: 60 * 60 },
  sendMessage: { points: 30, windowSeconds: 60 },
  revealPhone: { points: 10, windowSeconds: 60 * 60 },
  publishListing: { points: 10, windowSeconds: 60 * 60 },
  createReport: { points: 10, windowSeconds: 60 * 60 },
  /** L'export rassemble toute la base d'un compte : il n'a pas à être répétable à volonté. */
  dataExport: { points: 3, windowSeconds: 24 * 60 * 60 },
  search: { points: 120, windowSeconds: 60 },
  global: { points: 300, windowSeconds: 60 },
} as const;

export const PAGINATION = {
  defaultLimit: 24,
  maxLimit: 60,
} as const;

/**
 * Durées de conservation, en jours. Elles sont appliquées par les tâches
 * planifiées de l'API et reprises telles quelles dans la politique de
 * confidentialité et le registre des traitements.
 */
export const RETENTION_DAYS = {
  /** Compte sans connexion : avertissement puis anonymisation. */
  inactiveAccountWarning: 365 * 2,
  inactiveAccountDeletion: 365 * 3,
  expiredListing: 180,
  deletedListing: 30,
  /**
   * Les messages sont conservés **jusqu'à la suppression du compte** : ils sont
   * chiffrés de bout en bout, nous ne pouvons donc ni les lire ni en juger la
   * péremption, et les effacer d'office priverait leurs deux auteurs d'un
   * historique dont eux seuls détiennent la clé.
   */
  message: null,
  /** Vues d'annonces et affichages de numéro : compteurs, pas histoire. */
  viewTrace: 180,
  authToken: 30,
  revokedSession: 90,
  auditLog: 365 * 5,
  resolvedReport: 365 * 2,
  consentRecord: 365 * 3,
  /** Obligation comptable : paiements et reçus. */
  payment: 365 * 10,
  accessLog: 365,
  /** Un consentement est redemandé au-delà de cette durée. */
  consentValidity: 180,
} as const;
