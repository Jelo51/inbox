import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Env } from '../../../config/env.js';
import type { Logger } from '../../../lib/logger.js';
import type { Initiation, InitiationContext, PaymentGateway, VerifiedEvent } from './types.js';

/**
 * Maviance Smobilpay — Mobile Money MTN et Orange.
 *
 * Adaptateur écrit sans compte marchand ouvert : les appels sont conformes au
 * schéma habituel de l'API (initiation puis notification asynchrone), mais
 * **ils n'ont pas été éprouvés contre le service réel**. À rejouer en bac à
 * sable dès que le compte sera disponible ; le point à revérifier en premier
 * est le nom exact de l'en-tête de signature et l'ordre des champs signés.
 */
export function mavianceGateway(env: Env, logger: Logger): PaymentGateway {
  const baseUrl = env.MAVIANCE_BASE_URL!;
  const token = env.MAVIANCE_PUBLIC_TOKEN!;
  const secret = env.MAVIANCE_SECRET_KEY!;
  const merchantId = env.MAVIANCE_MERCHANT_ID!;

  const SERVICE_BY_METHOD = {
    MTN_MOMO: 'MTN_MOMO_CM',
    ORANGE_MONEY: 'ORANGE_MONEY_CM',
  } as const;

  return {
    name: 'MAVIANCE',
    methods: ['MTN_MOMO', 'ORANGE_MONEY'],

    async initiate(context: InitiationContext): Promise<Initiation> {
      const service =
        context.method === 'ORANGE_MONEY'
          ? SERVICE_BY_METHOD.ORANGE_MONEY
          : SERVICE_BY_METHOD.MTN_MOMO;

      const response = await fetch(`${baseUrl}/collectstd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Merchant-Id': merchantId,
        },
        body: JSON.stringify({
          serviceid: service,
          amount: context.amountXaf,
          currency: 'XAF',
          // Le numéro est transmis au fournisseur pour déclencher la demande
          // de confirmation sur le téléphone du payeur.
          customerPhonenumber: context.payerPhone,
          customerEmailaddress: context.userEmail,
          trid: context.reference,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        logger.error({ status: response.status, body }, 'initiation Maviance en échec');
        return { providerRef: null, status: 'FAILED' };
      }

      const payload = (await response.json()) as { ptn?: string };

      return {
        providerRef: payload.ptn ?? null,
        instructions:
          'Validez la demande de paiement reçue sur votre téléphone, puis revenez sur cette page.',
        status: 'PENDING',
      };
    },

    verifyWebhook(rawBody, headers): VerifiedEvent | null {
      const signature = headers['x-smobilpay-signature'] ?? headers['x-signature'];
      if (!signature) {
        logger.warn('notification Maviance sans signature : ignorée');
        return null;
      }

      const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);

      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        logger.warn('signature Maviance invalide : notification ignorée');
        return null;
      }

      try {
        const payload = JSON.parse(rawBody.toString('utf8')) as {
          ptn?: string;
          trid?: string;
          status?: string;
          amount?: number;
          errorCode?: string;
        };

        const providerRef = payload.ptn ?? payload.trid;
        if (!providerRef) return null;

        const succeeded = payload.status === 'SUCCESS' || payload.status === 'CONFIRMED';

        return {
          // À défaut d'identifiant d'événement propre, la référence du
          // fournisseur assure déjà l'idempotence en base.
          eventId: `maviance:${providerRef}:${payload.status ?? 'unknown'}`,
          providerRef,
          status: succeeded ? 'SUCCEEDED' : 'FAILED',
          amountXaf: payload.amount,
          failureCode: succeeded ? undefined : (payload.errorCode ?? payload.status),
        };
      } catch {
        logger.warn('notification Maviance illisible : ignorée');
        return null;
      }
    },
  };
}
