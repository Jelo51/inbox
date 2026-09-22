import { randomUUID } from 'node:crypto';
import type { Env } from '../../../config/env.js';
import type { Initiation, InitiationContext, PaymentGateway, VerifiedEvent } from './types.js';

/**
 * Fournisseur de démonstration.
 *
 * Il existe parce qu'aucun compte Maviance ni Stripe n'est ouvert : sans lui,
 * le parcours d'abonnement serait invérifiable et invisible. Il imite le vrai
 * déroulé — initiation, attente, confirmation **par le serveur** — plutôt que
 * d'activer l'abonnement dans le navigateur, ce qui ne prouverait rien.
 *
 * La validation de configuration le refuse en production.
 */
export function mockGateway(env: Env): PaymentGateway {
  return {
    name: 'MOCK',
    methods: ['MTN_MOMO', 'ORANGE_MONEY', 'CARD'],

    initiate(context: InitiationContext): Promise<Initiation> {
      const providerRef = `demo_${randomUUID()}`;

      return Promise.resolve({
        providerRef,
        // L'espace de paiement de démonstration reproduit l'attente réelle :
        // l'utilisateur y « confirme » comme il le ferait sur son téléphone.
        redirectUrl: `${env.APP_URL}/paiement/demonstration?reference=${encodeURIComponent(context.reference)}`,
        instructions:
          context.method === 'CARD'
            ? undefined
            : 'Espace de démonstration : aucun débit réel n’est effectué.',
        status: 'PENDING',
      });
    },

    /**
     * Le mode démonstration n'a pas de webhook signé : la confirmation passe
     * par une route dédiée, elle aussi interdite en production.
     */
    verifyWebhook(): VerifiedEvent | null {
      return null;
    },
  };
}
