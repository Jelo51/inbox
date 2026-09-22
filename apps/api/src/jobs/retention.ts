import { RETENTION_DAYS, addDays } from '@inbox/shared';
import { now } from '../lib/clock.js';
import { registerJob } from './scheduler.js';
import { anonymizeAccount } from '../modules/account/deletion.js';
import { createImageStorage } from '../modules/images/storage.js';
import { MailService } from '../modules/mail/service.js';
import { parseEnv } from '../config/env.js';

/**
 * Durées de conservation.
 *
 * Une politique de confidentialité qui annonce des durées sans tâche pour les
 * appliquer n'est pas une politique, c'est une déclaration d'intention. Ces
 * tâches sont ce qui la rend vraie.
 */

registerJob({
  name: 'purge-jetons-expires',
  schedule: '0 5 * * *',
  async run({ prisma, logger }) {
    const cutoff = addDays(now(), -RETENTION_DAYS.authToken);

    const tokens = await prisma.emailToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] },
    });

    // Une session révoquée garde un intérêt le temps qu'un utilisateur puisse
    // constater une connexion qu'il n'a pas faite ; passé ce délai, non.
    const sessions = await prisma.session.deleteMany({
      where: {
        OR: [
          { revokedAt: { lt: addDays(now(), -RETENTION_DAYS.revokedSession) } },
          { expiresAt: { lt: cutoff } },
        ],
      },
    });

    if (tokens.count + sessions.count > 0) {
      logger.info({ tokens: tokens.count, sessions: sessions.count }, 'jetons et sessions purgés');
    }
  },
});

/**
 * Signalements clos. La cascade emporte les `DisclosedMessage` — le seul texte
 * de conversation en clair du système : c'est la purge la plus importante de
 * toutes, et elle ne doit jamais être désactivée « temporairement ».
 */
registerJob({
  name: 'purge-signalements-clos',
  schedule: '15 5 * * *',
  async run({ prisma, logger }) {
    const cutoff = addDays(now(), -RETENTION_DAYS.resolvedReport);

    const { count } = await prisma.report.deleteMany({
      where: { status: { in: ['RESOLVED', 'DISMISSED'] }, handledAt: { lt: cutoff } },
    });

    if (count > 0) logger.info({ count }, 'signalements clos purgés');
  },
});

registerJob({
  name: 'purge-consentements',
  schedule: '30 5 * * *',
  async run({ prisma, logger }) {
    const cutoff = addDays(now(), -RETENTION_DAYS.consentRecord);

    const { count } = await prisma.consentRecord.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    if (count > 0) logger.info({ count }, 'traces de consentement purgées');
  },
});

/**
 * Traces de consultation : vues d'annonces et affichages de numéro. Elles
 * servent aux compteurs et à la limitation de fréquence, pas à l'histoire.
 */
registerJob({
  name: 'purge-traces-consultation',
  schedule: '45 5 * * *',
  async run({ prisma, logger }) {
    const cutoff = addDays(now(), -RETENTION_DAYS.viewTrace);

    const views = await prisma.listingView.deleteMany({ where: { viewedAt: { lt: cutoff } } });
    const reveals = await prisma.phoneReveal.deleteMany({ where: { revealedAt: { lt: cutoff } } });

    if (views.count + reveals.count > 0) {
      logger.info({ views: views.count, reveals: reveals.count }, 'traces de consultation purgées');
    }
  },
});

/**
 * Journal d'audit : cinq ans. Le déclencheur PostgreSQL refuse cette
 * suppression avant l'échéance — la tâche ne fait qu'exercer ce que la base
 * autorise, elle ne décide de rien.
 */
registerJob({
  name: 'purge-journal-audit',
  schedule: '0 6 * * 0',
  async run({ prisma, logger }) {
    const cutoff = addDays(now(), -RETENTION_DAYS.auditLog);

    const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (count > 0) logger.info({ count }, 'entrées de journal d’audit purgées');
  },
});

/**
 * Comptes inactifs : avertissement à deux ans, anonymisation à trois.
 *
 * L'avertissement précède toujours l'anonymisation d'une année entière, et il
 * part à l'adresse connue : une suppression dont personne n'a été prévenu
 * serait vécue comme une perte de données, à juste titre.
 */
registerJob({
  name: 'comptes-inactifs',
  schedule: '0 7 * * *',
  async run({ prisma, logger }) {
    const instant = now();
    const env = parseEnv(process.env);
    const mail = new MailService(env, logger);
    const storage = createImageStorage(env, logger);

    const lastActivity = (user: { lastLoginAt: Date | null; createdAt: Date }): Date =>
      user.lastLoginAt ?? user.createdAt;

    const warnBefore = addDays(instant, -RETENTION_DAYS.inactiveAccountWarning);
    const deleteBefore = addDays(instant, -RETENTION_DAYS.inactiveAccountDeletion);

    const candidates = await prisma.user.findMany({
      where: {
        anonymizedAt: null,
        status: { not: 'DELETED' },
        OR: [
          { lastLoginAt: { lt: warnBefore } },
          { lastLoginAt: null, createdAt: { lt: warnBefore } },
        ],
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        locale: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
        inactivityWarnedAt: true,
      },
      take: 200,
    });

    let warned = 0;
    let anonymized = 0;

    for (const user of candidates) {
      const since = lastActivity(user);

      // Un compte de l'équipe ne s'anonymise pas tout seul : perdre son dernier
      // administrateur pour cause d'inactivité serait une panne, pas une purge.
      if (user.role !== 'USER') continue;

      if (since < deleteBefore && user.inactivityWarnedAt) {
        await anonymizeAccount({ prisma, storage, logger }, user.id, instant);
        anonymized += 1;
        continue;
      }

      if (!user.inactivityWarnedAt) {
        const deletionDate = addDays(since, RETENTION_DAYS.inactiveAccountDeletion);
        await mail.sendInactiveAccountWarning(
          { email: user.email, displayName: user.displayName, locale: user.locale as 'fr' | 'en' },
          {
            deletionDate: deletionDate.toISOString().slice(0, 10),
            monthsInactive: Math.floor(
              (instant.getTime() - since.getTime()) / (1000 * 60 * 60 * 24 * 30),
            ),
          },
        );
        await prisma.user.update({
          where: { id: user.id },
          data: { inactivityWarnedAt: instant },
        });
        warned += 1;
      }
    }

    if (warned + anonymized > 0) {
      logger.info({ warned, anonymized }, 'comptes inactifs traités');
    }
  },
});
