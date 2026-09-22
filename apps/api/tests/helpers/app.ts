import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { createLogger } from '../../src/lib/logger.js';
import { MailService } from '../../src/modules/mail/service.js';
import type { MailTransport, OutgoingEmail } from '../../src/modules/mail/transport.js';

/**
 * Transport d'e-mails qui garde tout en mémoire : les tests peuvent alors lire
 * le lien de vérification réellement envoyé, plutôt que de le fabriquer.
 */
export class MemoryTransport implements MailTransport {
  readonly name = 'memory';
  readonly sent: OutgoingEmail[] = [];

  send(email: OutgoingEmail): Promise<void> {
    this.sent.push(email);
    return Promise.resolve();
  }

  lastTo(email: string): OutgoingEmail | undefined {
    return [...this.sent].reverse().find((m) => m.to === email);
  }

  /** Extrait le jeton du lien contenu dans le dernier e-mail envoyé à cette adresse. */
  tokenFor(email: string): string {
    const message = this.lastTo(email);
    if (!message) throw new Error(`aucun e-mail envoyé à ${email}`);
    const match = message.text.match(/[?&]token=([^\s&]+)/);
    if (!match?.[1]) throw new Error(`aucun jeton dans l'e-mail envoyé à ${email}`);
    return decodeURIComponent(match[1]);
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export function buildTestApp() {
  const env = parseEnv();
  const prisma = new PrismaClient();
  const logger = createLogger();
  const transport = new MemoryTransport();
  const mail = new MailService(env, logger, transport);
  const app = createApp({ env, prisma, logger, mail });

  return { app, prisma, transport, env };
}
