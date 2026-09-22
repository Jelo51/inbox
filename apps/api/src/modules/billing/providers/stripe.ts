import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Env } from '../../../config/env.js';
import type { Logger } from '../../../lib/logger.js';
import type { Initiation, InitiationContext, PaymentGateway, VerifiedEvent } from './types.js';

/**
 * Stripe — paiement par carte.
 *
 * Appelé directement en HTTP plutôt que par le SDK : une seule requête
 * (création de session de paiement) et une vérification de signature ne
 * justifient pas une dépendance de plusieurs mégaoctets.
 *
 * Réserve : à notre connaissance, le Cameroun ne figure pas parmi les pays où
 * Stripe accepte l'ouverture d'un compte marchand. Cet adaptateur ne servira
 * que si l'éditeur dispose d'une entité éligible ; sinon il faudra le
 * remplacer par un agrégateur couvrant le Cameroun. Le reste du code n'en sera
 * pas affecté.
 */
export function stripeGateway(env: Env, logger: Logger): PaymentGateway {
  const secretKey = env.STRIPE_SECRET_KEY!;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET!;

  return {
    name: 'STRIPE',
    methods: ['CARD'],

    async initiate(context: InitiationContext): Promise<Initiation> {
      const form = new URLSearchParams({
        mode: 'payment',
        'payment_method_types[0]': 'card',
        // Le franc CFA n'a pas de sous-unité : le montant est transmis tel quel.
        'line_items[0][price_data][currency]': 'xaf',
        'line_items[0][price_data][unit_amount]': String(context.amountXaf),
        'line_items[0][price_data][product_data][name]': context.planName,
        'line_items[0][quantity]': '1',
        client_reference_id: context.reference,
        customer_email: context.userEmail,
        success_url: `${context.returnUrl}?reference=${encodeURIComponent(context.reference)}`,
        cancel_url: `${context.returnUrl}?annule=1`,
      });

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          // Rejouer la même requête ne crée pas deux sessions de paiement.
          'Idempotency-Key': context.reference,
        },
        body: form,
      });

      if (!response.ok) {
        const body = await response.text();
        logger.error({ status: response.status, body }, 'création de session Stripe en échec');
        return { providerRef: null, status: 'FAILED' };
      }

      const session = (await response.json()) as { id: string; url: string };
      return { providerRef: session.id, redirectUrl: session.url, status: 'PENDING' };
    },

    /**
     * Vérification de la signature `Stripe-Signature`. La tolérance de cinq
     * minutes ferme la fenêtre de rejeu d'une notification interceptée.
     */
    verifyWebhook(rawBody, headers): VerifiedEvent | null {
      const header = headers['stripe-signature'];
      if (!header) {
        logger.warn('webhook Stripe sans signature : ignoré');
        return null;
      }

      const parts = Object.fromEntries(
        header.split(',').map((part) => part.split('=', 2) as [string, string]),
      );
      const timestamp = parts.t;
      const provided = parts.v1;
      if (!timestamp || !provided) return null;

      const age = Math.abs(Date.now() / 1000 - Number(timestamp));
      if (!Number.isFinite(age) || age > 300) {
        logger.warn({ age }, 'webhook Stripe hors fenêtre temporelle : ignoré');
        return null;
      }

      const expected = createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${rawBody.toString('utf8')}`)
        .digest('hex');

      const a = Buffer.from(expected);
      const b = Buffer.from(provided);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        logger.warn('signature Stripe invalide : webhook ignoré');
        return null;
      }

      try {
        const event = JSON.parse(rawBody.toString('utf8')) as {
          id: string;
          type: string;
          data: { object: { id: string; amount_total?: number; payment_status?: string } };
        };

        const session = event.data.object;

        if (event.type === 'checkout.session.completed') {
          return {
            eventId: event.id,
            providerRef: session.id,
            status: session.payment_status === 'paid' ? 'SUCCEEDED' : 'FAILED',
            amountXaf: session.amount_total,
          };
        }

        if (
          event.type === 'checkout.session.expired' ||
          event.type === 'checkout.session.async_payment_failed'
        ) {
          return {
            eventId: event.id,
            providerRef: session.id,
            status: 'FAILED',
            failureCode: event.type,
          };
        }

        // Tout autre type d'événement ne concerne pas l'abonnement.
        return null;
      } catch {
        logger.warn('webhook Stripe illisible : ignoré');
        return null;
      }
    },
  };
}
