import type { PaymentMethod, PaymentProvider as ProviderName } from '@inbox/shared';

export interface InitiationContext {
  /** Référence interne, visible par l'utilisateur et par le support. */
  reference: string;
  amountXaf: number;
  planName: string;
  /** Numéro Mobile Money du payeur, pour MTN et Orange. */
  payerPhone?: string;
  method: PaymentMethod;
  userEmail: string;
  returnUrl: string;
}

export interface Initiation {
  providerRef: string | null;
  /** Page de paiement du fournisseur, pour la carte. */
  redirectUrl?: string;
  /** Consigne affichée à l'utilisateur, pour le Mobile Money. */
  instructions?: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}

/**
 * Événement issu d'un webhook, une fois sa signature vérifiée. `eventId` porte
 * l'idempotence : le même événement rejoué ne doit rien changer.
 */
export interface VerifiedEvent {
  eventId: string;
  providerRef: string;
  status: 'SUCCEEDED' | 'FAILED';
  amountXaf?: number;
  failureCode?: string;
}

export interface PaymentGateway {
  readonly name: ProviderName;
  readonly methods: readonly PaymentMethod[];

  initiate(context: InitiationContext): Promise<Initiation>;

  /**
   * Vérifie l'authenticité d'une notification. Renvoie `null` si la signature
   * est absente, invalide, ou si l'événement ne concerne pas un paiement —
   * dans tous ces cas, rien ne doit être activé.
   */
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | undefined>): VerifiedEvent | null;
}
