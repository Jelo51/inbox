import type { PaymentMethod } from '@inbox/shared';
import type { Env } from '../../../config/env.js';
import type { Logger } from '../../../lib/logger.js';
import { mockGateway } from './mock.js';
import { mavianceGateway } from './maviance.js';
import { stripeGateway } from './stripe.js';
import type { PaymentGateway } from './types.js';

export type { PaymentGateway, Initiation, InitiationContext, VerifiedEvent } from './types.js';

/**
 * Choisit le fournisseur selon le moyen de paiement et la configuration.
 * Le Mobile Money et la carte suivent des chemins distincts, et l'un peut être
 * en démonstration pendant que l'autre est en production.
 */
export function createGateways(env: Env, logger: Logger): Map<PaymentMethod, PaymentGateway> {
  const mobile =
    env.PAYMENT_PROVIDER_MOBILE === 'MAVIANCE' ? mavianceGateway(env, logger) : mockGateway(env);
  const card =
    env.PAYMENT_PROVIDER_CARD === 'STRIPE' ? stripeGateway(env, logger) : mockGateway(env);

  return new Map<PaymentMethod, PaymentGateway>([
    ['MTN_MOMO', mobile],
    ['ORANGE_MONEY', mobile],
    ['CARD', card],
  ]);
}

export function gatewayByName(
  gateways: Map<PaymentMethod, PaymentGateway>,
  name: string,
): PaymentGateway | null {
  for (const gateway of gateways.values()) {
    if (gateway.name === name) return gateway;
  }
  return null;
}
