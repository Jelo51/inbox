import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  LISTING_CONDITIONS,
  LISTING_STATUSES,
  LEGAL_DOCUMENT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  PRICE_UNITS,
  REPORT_STATUSES,
  REPORT_TARGETS,
  SUBSCRIPTION_STATUSES,
  USER_ROLES,
  USER_STATUSES,
} from '@inbox/shared';

/**
 * `packages/shared` duplique volontairement les énumérations Prisma pour que le
 * front n'ait pas à dépendre de @prisma/client. Ce test empêche les deux
 * copies de diverger en silence.
 */
const PAIRS: [string, readonly string[]][] = [
  ['UserRole', USER_ROLES],
  ['UserStatus', USER_STATUSES],
  ['ListingStatus', LISTING_STATUSES],
  ['ListingCondition', LISTING_CONDITIONS],
  ['PriceUnit', PRICE_UNITS],
  ['ReportTarget', REPORT_TARGETS],
  ['ReportStatus', REPORT_STATUSES],
  ['SubscriptionStatus', SUBSCRIPTION_STATUSES],
  ['PaymentProvider', PAYMENT_PROVIDERS],
  ['PaymentMethod', PAYMENT_METHODS],
  ['PaymentStatus', PAYMENT_STATUSES],
  ['LegalDocumentType', LEGAL_DOCUMENT_TYPES],
];

describe('énumérations partagées', () => {
  it.each(PAIRS)('%s est identique côté Prisma et côté shared', (name, shared) => {
    const prismaEnum = Prisma.dmmf.datamodel.enums.find((e) => e.name === name);
    expect(prismaEnum, `énumération Prisma ${name} introuvable`).toBeDefined();
    expect([...(prismaEnum?.values.map((v) => v.name) ?? [])].sort()).toEqual([...shared].sort());
  });
});
