import type { Env } from '../../config/env.js';
import type { Logger } from '../../lib/logger.js';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailTransport {
  readonly name: string;
  send(email: OutgoingEmail): Promise<void>;
}

/**
 * Transport de développement : rien n'est envoyé, tout est écrit sur la sortie
 * standard. Le lien de vérification est donc récupérable sans compte Resend,
 * ce qui permet de dérouler le parcours d'inscription en local.
 */
function consoleTransport(): MailTransport {
  return {
    name: 'console',
    send(email) {
      /* eslint-disable no-console -- la console est ici le canal de livraison,
         pas une trace de débogage : c'est ainsi que le développeur récupère le
         lien de vérification sans compte Resend. */
      console.log('');
      console.log('─'.repeat(70));
      console.log(`E-mail (non envoyé, transport console)`);
      console.log(`À        : ${email.to}`);
      console.log(`Objet    : ${email.subject}`);
      console.log('─'.repeat(70));
      console.log(email.text);
      console.log('─'.repeat(70));
      console.log('');
      /* eslint-enable no-console */
      return Promise.resolve();
    },
  };
}

/**
 * Resend. Appelé par `fetch` plutôt que par le SDK : une dépendance de plus
 * pour une seule requête HTTP ne se justifie pas.
 */
function resendTransport(env: Env, logger: Logger): MailTransport {
  return {
    name: 'resend',
    async send(email) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [email.to],
          subject: email.subject,
          text: email.text,
          html: email.html,
          ...(env.MAIL_REPLY_TO && { reply_to: env.MAIL_REPLY_TO }),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        // L'adresse du destinataire n'est jamais journalisée.
        logger.error({ status: response.status, body }, 'échec d’envoi d’e-mail');
        throw new Error(`Resend a répondu ${response.status}`);
      }
    },
  };
}

export function createMailTransport(env: Env, logger: Logger): MailTransport {
  if (env.RESEND_API_KEY) return resendTransport(env, logger);

  if (env.isProduction) {
    // Inatteignable : la validation de la configuration exige RESEND_API_KEY
    // en production. Le garde reste, au cas où cette règle bougerait.
    throw new Error('RESEND_API_KEY est obligatoire en production');
  }

  return consoleTransport();
}
