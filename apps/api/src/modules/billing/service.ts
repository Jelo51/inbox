import { randomUUID } from 'node:crypto';
import type { Payment, PrismaClient, Subscription } from '@prisma/client';
import {
  addDays,
  formatPrice,
  type PaymentMethod,
  type StartSubscriptionInput,
} from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import type { Logger } from '../../lib/logger.js';
import type { MailService } from '../mail/service.js';
import type { PaymentGateway, VerifiedEvent } from './providers/index.js';
import { issueReceipt } from './receipts.js';

export interface BillingDeps {
  prisma: PrismaClient;
  gateways: Map<PaymentMethod, PaymentGateway>;
  mail: MailService;
  logger: Logger;
  appUrl: string;
  now: () => Date;
}

/** Référence interne lisible : INB-PAY-XXXXXXXX. */
function newReference(): string {
  return `INB-PAY-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

export async function activeSubscription(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<Subscription | null> {
  return prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE', endsAt: { gt: now } },
    orderBy: { endsAt: 'desc' },
  });
}

/**
 * Démarre un abonnement. Rien n'est activé ici : l'abonnement reste `PENDING`
 * et le paiement `PENDING` jusqu'à confirmation **par le serveur**. Une
 * redirection de navigateur ne prouve pas qu'un paiement a eu lieu.
 */
export async function startSubscription(
  deps: BillingDeps,
  userId: string,
  input: StartSubscriptionInput,
): Promise<{ payment: Payment; redirectUrl?: string; instructions?: string }> {
  const now = deps.now();

  const [user, plan] = await Promise.all([
    deps.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    deps.prisma.plan.findUnique({ where: { code: input.planCode } }),
  ]);

  if (!plan?.isActive) throw HttpError.notFound('UNKNOWN_PLAN', 'Offre indisponible');

  if (await activeSubscription(deps.prisma, userId, now)) {
    throw HttpError.conflict('ALREADY_SUBSCRIBED', 'Vous avez déjà un abonnement en cours');
  }

  const gateway = deps.gateways.get(input.method);
  if (!gateway) {
    throw HttpError.badRequest('UNSUPPORTED_METHOD', 'Moyen de paiement indisponible');
  }

  // Le montant vient de la base, jamais du client.
  const amountXaf = plan.priceXaf;
  const vatXaf = Math.round((amountXaf * plan.vatRateBp) / (10_000 + plan.vatRateBp));

  const subscription = await deps.prisma.subscription.create({
    data: { userId, planId: plan.id, status: 'PENDING', createdAt: now },
  });

  const reference = newReference();

  const payment = await deps.prisma.payment.create({
    data: {
      userId,
      subscriptionId: subscription.id,
      provider: gateway.name,
      method: input.method,
      status: 'PENDING',
      amountXaf,
      vatXaf,
      reference,
      createdAt: now,
    },
  });

  const initiation = await gateway.initiate({
    reference,
    amountXaf,
    planName: plan.nameFr,
    method: input.method,
    payerPhone: 'payerPhone' in input ? input.payerPhone : undefined,
    userEmail: user.email,
    returnUrl: `${deps.appUrl}/compte/abonnement`,
  });

  const updated = await deps.prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerRef: initiation.providerRef,
      ...(initiation.status === 'FAILED' && { status: 'FAILED', failureCode: 'INITIATION_FAILED' }),
    },
  });

  if (initiation.status === 'FAILED') {
    await deps.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'PAYMENT_FAILED' },
    });
    throw new HttpError(
      502,
      'PAYMENT_INITIATION_FAILED',
      'Le fournisseur de paiement est indisponible. Réessayez dans quelques minutes.',
    );
  }

  return {
    payment: updated,
    redirectUrl: initiation.redirectUrl,
    instructions: initiation.instructions,
  };
}

/**
 * Applique une confirmation de paiement.
 *
 * **Idempotent** : le même événement rejoué — ce qui arrive couramment, les
 * fournisseurs réémettant tant qu'ils n'ont pas reçu un 200 — ne prolonge pas
 * l'abonnement une seconde fois. La garantie est portée par une contrainte
 * d'unicité en base, pas par un test applicatif qui perdrait la course.
 */
export async function applyPaymentEvent(
  deps: BillingDeps,
  event: VerifiedEvent,
): Promise<'APPLIED' | 'DUPLICATE' | 'UNKNOWN_PAYMENT'> {
  const now = deps.now();

  const payment = await deps.prisma.payment.findFirst({
    where: { OR: [{ providerRef: event.providerRef }, { reference: event.providerRef }] },
    include: { subscription: { include: { plan: true } }, user: true },
  });

  if (!payment) {
    deps.logger.warn({ providerRef: event.providerRef }, 'paiement inconnu dans la notification');
    return 'UNKNOWN_PAYMENT';
  }

  if (payment.webhookEventId === event.eventId || payment.status !== 'PENDING') {
    return 'DUPLICATE';
  }

  try {
    await deps.prisma.payment.update({
      where: { id: payment.id },
      // La contrainte d'unicité sur webhookEventId fait échouer un rejeu
      // concurrent : c'est la base qui tranche, pas une lecture préalable.
      data: {
        webhookEventId: event.eventId,
        status: event.status,
        failureCode: event.failureCode ?? null,
        paidAt: event.status === 'SUCCEEDED' ? now : null,
      },
    });
  } catch {
    return 'DUPLICATE';
  }

  if (event.status !== 'SUCCEEDED') {
    if (payment.subscriptionId) {
      await deps.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 'PAYMENT_FAILED' },
      });
    }
    await deps.mail.sendPaymentFailed(payment.user, formatPrice(payment.amountXaf));
    return 'APPLIED';
  }

  const plan = payment.subscription?.plan;
  if (payment.subscriptionId && plan) {
    const current = await activeSubscription(deps.prisma, payment.userId, now);
    // Un renouvellement prolonge la période en cours au lieu de la remplacer.
    const startsAt = current?.endsAt ?? now;

    await deps.prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: {
        status: 'ACTIVE',
        startedAt: startsAt,
        endsAt: addDays(startsAt, plan.periodDays),
        renewalNoticeSentAt: null,
      },
    });

    await promoteToPro(deps.prisma, payment.userId);
  }

  const receipt = await issueReceipt(deps.prisma, payment, now);
  deps.logger.info({ reference: payment.reference, receipt: receipt.number }, 'paiement confirmé');

  const renewed = payment.subscriptionId
    ? await deps.prisma.subscription.findUnique({ where: { id: payment.subscriptionId } })
    : null;

  await deps.mail.sendPaymentConfirmed(payment.user, {
    planName: plan?.nameFr ?? 'Inbox Pro',
    amountLabel: formatPrice(payment.amountXaf),
    receiptNumber: receipt.number,
    endsAt: renewed?.endsAt
      ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(renewed.endsAt)
      : '',
  });

  return 'APPLIED';
}

/**
 * Passe le compte en PRO. Un modérateur ou un administrateur qui s'abonne
 * garde son rôle : le rétrograder lui retirerait ses accès.
 */
export async function promoteToPro(prisma: PrismaClient, userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== 'USER') return;

  await prisma.user.update({ where: { id: userId }, data: { role: 'PRO' } });
  // Les annonces déjà en ligne bénéficient immédiatement de la remontée.
  await prisma.listing.updateMany({ where: { sellerId: userId }, data: { sellerIsPro: true } });
}

export async function demoteFromPro(prisma: PrismaClient, userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== 'PRO') return;

  await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } });
  await prisma.listing.updateMany({ where: { sellerId: userId }, data: { sellerIsPro: false } });
}

/**
 * Résiliation en un clic. Elle prend effet à la fin de la période déjà payée :
 * couper immédiatement reviendrait à reprendre un service facturé.
 */
export async function cancelSubscription(
  deps: BillingDeps,
  userId: string,
  reason?: string,
): Promise<Subscription> {
  const now = deps.now();
  const subscription = await activeSubscription(deps.prisma, userId, now);

  if (!subscription) {
    throw HttpError.notFound('NO_SUBSCRIPTION', 'Aucun abonnement en cours');
  }
  if (subscription.cancelledAt) {
    throw HttpError.conflict('ALREADY_CANCELLED', 'Cet abonnement est déjà résilié');
  }

  return deps.prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelledAt: now, cancellationReason: reason ?? null },
  });
}

export async function paymentHistory(prisma: PrismaClient, userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    include: { receipt: true, subscription: { include: { plan: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
