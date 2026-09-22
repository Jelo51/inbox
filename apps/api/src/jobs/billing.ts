import { addDays, formatPrice } from '@inbox/shared';
import { now } from '../lib/clock.js';
import { registerJob } from './scheduler.js';
import { demoteFromPro } from '../modules/billing/service.js';
import { MailService } from '../modules/mail/service.js';
import { parseEnv } from '../config/env.js';

/**
 * Expiration des abonnements arrivés à échéance.
 *
 * Le statut PRO n'est pas déduit d'un calcul à la volée mais porté par le rôle
 * de l'utilisateur : il faut donc le retirer explicitement. Faire dépendre
 * chaque contrôle d'accès d'un calcul de date multiplierait les occasions de
 * se tromper.
 */
registerJob({
  name: 'expiration-abonnements',
  schedule: '0 2 * * *',
  async run({ prisma, logger }) {
    const instant = now();

    const expirees = await prisma.subscription.findMany({
      where: { status: 'ACTIVE', endsAt: { lte: instant } },
      select: { id: true, userId: true },
    });

    for (const subscription of expirees) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' },
      });
      await demoteFromPro(prisma, subscription.userId);
    }

    if (expirees.length > 0) logger.info({ count: expirees.length }, 'abonnements expirés');
  },
});

/**
 * Relance trois jours avant l'échéance. `renewalNoticeSentAt` évite le doublon
 * si la tâche tourne deux fois — ce qui arrive au redémarrage d'un serveur.
 */
registerJob({
  name: 'relance-echeance-abonnement',
  schedule: '0 9 * * *',
  async run({ prisma, logger }) {
    const instant = now();
    const env = parseEnv();
    const mail = new MailService(env, logger);

    const echeances = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        renewalNoticeSentAt: null,
        endsAt: { gt: instant, lte: addDays(instant, 3) },
      },
      include: { user: true, plan: true },
    });

    for (const subscription of echeances) {
      if (!subscription.endsAt) continue;

      const prefs = await prisma.notificationPreference.findUnique({
        where: { userId: subscription.userId },
      });
      if (prefs && !prefs.emailOnSubscriptionRenewal) continue;

      await mail.sendRenewalNotice(subscription.user, {
        amountLabel: formatPrice(subscription.plan.priceXaf),
        endsAt: new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(subscription.endsAt),
        cancelled: subscription.cancelledAt !== null,
      });

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { renewalNoticeSentAt: instant },
      });
    }

    if (echeances.length > 0)
      logger.info({ count: echeances.length }, 'relances d’échéance envoyées');
  },
});

/**
 * Purge des paiements au-delà de la durée de conservation comptable. Les reçus
 * disparaissent avec eux : ils n'ont plus de valeur probante isolés.
 */
registerJob({
  name: 'purge-paiements',
  schedule: '30 4 * * 0',
  async run({ prisma, logger }) {
    // Dix ans : voir RETENTION_DAYS.payment dans packages/shared.
    const cutoff = addDays(now(), -3650);

    const { count } = await prisma.payment.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    if (count > 0) logger.info({ count }, 'paiements purgés');
  },
});
