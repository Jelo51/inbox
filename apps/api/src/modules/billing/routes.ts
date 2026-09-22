import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  cancelSubscriptionSchema,
  formatPrice,
  idSchema,
  mockPaymentConfirmSchema,
  startSubscriptionSchema,
} from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import { now } from '../../lib/clock.js';
import { requireAuth, requireVerifiedEmail } from '../../middleware/auth.js';
import { gatewayByName } from './providers/index.js';
import * as billing from './service.js';
import { renderReceiptPdf } from './receipts.js';

function handle(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

export function billingRouter(prisma: PrismaClient, deps: billing.BillingDeps): Router {
  const router = Router();
  const authenticated = requireAuth(prisma);

  // ── Offre ─────────────────────────────────────────────────────────────────

  router.get(
    '/plans',
    handle(async (_req, res) => {
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { priceXaf: 'asc' },
      });

      res.json({
        plans: plans.map((plan) => ({
          code: plan.code,
          nameFr: plan.nameFr,
          nameEn: plan.nameEn,
          priceXaf: plan.priceXaf,
          priceLabel: formatPrice(plan.priceXaf),
          vatRateBp: plan.vatRateBp,
          periodDays: plan.periodDays,
        })),
        // Le mode de paiement effectif est public : l'utilisateur doit savoir
        // s'il se trouve dans un espace de démonstration.
        demo: [...deps.gateways.values()].some((gateway) => gateway.name === 'MOCK'),
      });
    }),
  );

  // ── Abonnement ────────────────────────────────────────────────────────────

  router.get(
    '/subscription',
    authenticated,
    handle(async (req, res) => {
      const subscription = await prisma.subscription.findFirst({
        where: { userId: req.auth!.userId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              planName: subscription.plan.nameFr,
              priceXaf: subscription.plan.priceXaf,
              startedAt: subscription.startedAt,
              endsAt: subscription.endsAt,
              cancelledAt: subscription.cancelledAt,
            }
          : null,
        isPro: req.auth!.role === 'PRO',
      });
    }),
  );

  router.post(
    '/subscription',
    authenticated,
    requireVerifiedEmail,
    handle(async (req, res) => {
      const input = startSubscriptionSchema.parse(req.body);
      const result = await billing.startSubscription(deps, req.auth!.userId, input);

      res.status(201).json({
        payment: {
          reference: result.payment.reference,
          amountXaf: result.payment.amountXaf,
          status: result.payment.status,
        },
        redirectUrl: result.redirectUrl,
        instructions: result.instructions,
      });
    }),
  );

  router.delete(
    '/subscription',
    authenticated,
    handle(async (req, res) => {
      const { reason } = cancelSubscriptionSchema.parse(req.body ?? {});
      const subscription = await billing.cancelSubscription(deps, req.auth!.userId, reason);

      res.json({
        subscription: {
          id: subscription.id,
          cancelledAt: subscription.cancelledAt,
          endsAt: subscription.endsAt,
        },
      });
    }),
  );

  // ── Paiements et reçus ────────────────────────────────────────────────────

  router.get(
    '/payments',
    authenticated,
    handle(async (req, res) => {
      const payments = await billing.paymentHistory(prisma, req.auth!.userId);

      res.json({
        items: payments.map((payment) => ({
          id: payment.id,
          reference: payment.reference,
          amountXaf: payment.amountXaf,
          amountLabel: formatPrice(payment.amountXaf),
          method: payment.method,
          provider: payment.provider,
          status: payment.status,
          paidAt: payment.paidAt,
          createdAt: payment.createdAt,
          planName: payment.subscription?.plan.nameFr ?? null,
          receiptNumber: payment.receipt?.number ?? null,
        })),
      });
    }),
  );

  router.get(
    '/payments/:id/receipt',
    authenticated,
    handle(async (req, res) => {
      const id = idSchema.parse(req.params.id);

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          receipt: true,
          user: true,
          subscription: { include: { plan: true } },
        },
      });

      if (!payment) throw HttpError.notFound();
      // Un reçu est une pièce comptable nominative : personne d'autre.
      if (payment.userId !== req.auth!.userId) throw HttpError.forbidden();
      if (!payment.receipt) {
        throw HttpError.notFound('NO_RECEIPT', 'Aucun reçu pour ce paiement');
      }

      const pdf = await renderReceiptPdf({
        receipt: payment.receipt,
        payment,
        buyerName: payment.user.displayName,
        buyerEmail: payment.user.email,
        planName: payment.subscription?.plan.nameFr ?? 'Abonnement Inbox Pro',
        periodStart: payment.subscription?.startedAt ?? null,
        periodEnd: payment.subscription?.endsAt ?? null,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="recu-${payment.receipt.number}.pdf"`,
      );
      res.send(Buffer.from(pdf));
    }),
  );

  // ── Webhooks ──────────────────────────────────────────────────────────────

  /**
   * Les notifications des fournisseurs arrivent ici. Le corps est reçu brut
   * (voir `app.ts`) : recalculer une signature sur un JSON re-sérialisé
   * échouerait, l'ordre des clés et les espaces n'étant pas préservés.
   *
   * On répond 200 même quand la signature est invalide ou le paiement inconnu :
   * détailler l'échec renseignerait un attaquant, et déclencherait chez le
   * fournisseur des réémissions sans fin.
   */
  router.post(
    '/billing/webhooks/:provider',
    handle(async (req, res) => {
      const gateway = gatewayByName(deps.gateways, (req.params.provider ?? '').toUpperCase());

      if (!gateway || gateway.name === 'MOCK') {
        res
          .status(404)
          .json({ error: { code: 'UNKNOWN_PROVIDER', message: 'Fournisseur inconnu' } });
        return;
      }

      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      const event = gateway.verifyWebhook(
        rawBody,
        req.headers as Record<string, string | undefined>,
      );

      if (!event) {
        res.status(200).json({ received: true });
        return;
      }

      await billing.applyPaymentEvent(deps, event);
      res.status(200).json({ received: true });
    }),
  );

  /**
   * Confirmation de l'espace de paiement de démonstration.
   *
   * Elle emprunte exactement le même chemin qu'un webhook réel — c'est le
   * serveur qui décide, jamais le navigateur — mais n'existe que hors
   * production. La validation de configuration refuse déjà le fournisseur
   * `MOCK` en production ; ce garde est une seconde barrière.
   */
  router.post(
    '/billing/demo/confirm',
    authenticated,
    handle(async (req, res) => {
      const usingMock = [...deps.gateways.values()].some((gateway) => gateway.name === 'MOCK');
      if (!usingMock || process.env.NODE_ENV === 'production') {
        throw HttpError.forbidden('DEMO_DISABLED', 'Espace de démonstration indisponible');
      }

      const input = mockPaymentConfirmSchema.parse(req.body);

      const payment = await prisma.payment.findUnique({ where: { reference: input.reference } });
      if (!payment) throw HttpError.notFound('UNKNOWN_PAYMENT', 'Paiement introuvable');
      if (payment.userId !== req.auth!.userId) throw HttpError.forbidden();

      const outcome = await billing.applyPaymentEvent(deps, {
        eventId: `demo:${payment.reference}:${input.outcome}`,
        providerRef: payment.providerRef ?? payment.reference,
        status: input.outcome,
        amountXaf: payment.amountXaf,
        ...(input.outcome === 'FAILED' && { failureCode: 'DEMO_DECLINED' }),
      });

      res.json({ outcome, confirmedAt: now() });
    }),
  );

  return router;
}
