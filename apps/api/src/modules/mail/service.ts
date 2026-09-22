import type { Locale } from '@inbox/shared';
import type { Env } from '../../config/env.js';
import type { Logger } from '../../lib/logger.js';
import { createMailTransport, type MailTransport } from './transport.js';
import {
  emailChangeTemplate,
  passwordChangedTemplate,
  passwordResetTemplate,
  paymentConfirmedTemplate,
  paymentFailedTemplate,
  renewalNoticeTemplate,
  verifyEmailTemplate,
  type TemplateContext,
} from './templates.js';

export interface MailRecipient {
  email: string;
  displayName: string;
  locale: string;
}

export class MailService {
  private readonly transport: MailTransport;

  constructor(
    private readonly env: Env,
    private readonly logger: Logger,
    transport?: MailTransport,
  ) {
    this.transport = transport ?? createMailTransport(env, logger);
  }

  get transportName(): string {
    return this.transport.name;
  }

  private context(recipient: MailRecipient): TemplateContext {
    return {
      locale: (recipient.locale === 'en' ? 'en' : 'fr') satisfies Locale,
      name: recipient.displayName,
      appUrl: this.env.APP_URL,
    };
  }

  /**
   * Un e-mail qui ne part pas ne doit pas faire échouer l'action de
   * l'utilisateur : l'inscription reste valide même si le fournisseur est en
   * panne, et un renvoi est toujours possible.
   */
  private async deliver(
    recipient: MailRecipient,
    rendered: ReturnType<typeof verifyEmailTemplate>,
  ) {
    try {
      await this.transport.send({ to: recipient.email, ...rendered });
    } catch (err) {
      this.logger.error({ err, template: rendered.subject }, 'e-mail non délivré');
    }
  }

  async sendEmailVerification(recipient: MailRecipient, token: string): Promise<void> {
    const url = `${this.env.APP_URL}/verifier-email?token=${encodeURIComponent(token)}`;
    await this.deliver(recipient, verifyEmailTemplate(this.context(recipient), url));
  }

  async sendPasswordReset(recipient: MailRecipient, token: string): Promise<void> {
    const url = `${this.env.APP_URL}/nouveau-mot-de-passe?token=${encodeURIComponent(token)}`;
    await this.deliver(recipient, passwordResetTemplate(this.context(recipient), url));
  }

  async sendEmailChangeConfirmation(recipient: MailRecipient, token: string): Promise<void> {
    const url = `${this.env.APP_URL}/confirmer-email?token=${encodeURIComponent(token)}`;
    await this.deliver(recipient, emailChangeTemplate(this.context(recipient), url));
  }

  async sendPasswordChanged(recipient: MailRecipient): Promise<void> {
    await this.deliver(recipient, passwordChangedTemplate(this.context(recipient)));
  }

  async sendPaymentConfirmed(
    recipient: MailRecipient,
    details: { planName: string; amountLabel: string; receiptNumber: string; endsAt: string },
  ): Promise<void> {
    await this.deliver(recipient, paymentConfirmedTemplate(this.context(recipient), details));
  }

  async sendPaymentFailed(recipient: MailRecipient, amountLabel: string): Promise<void> {
    await this.deliver(recipient, paymentFailedTemplate(this.context(recipient), { amountLabel }));
  }

  async sendRenewalNotice(
    recipient: MailRecipient,
    details: { amountLabel: string; endsAt: string; cancelled: boolean },
  ): Promise<void> {
    await this.deliver(recipient, renewalNoticeTemplate(this.context(recipient), details));
  }
}
