import { addDays, LISTING_LIMITS, RETENTION_DAYS } from '@inbox/shared';
import { now } from '../lib/clock.js';
import { registerJob } from './scheduler.js';

/**
 * Expiration automatique des annonces publiées.
 *
 * Tourne chaque nuit à 03:00, heure de Douala. `expiresAt` est posé à la
 * publication : la tâche ne fait que constater l'échéance, elle ne la calcule
 * pas. Si elle ne tourne pas pendant trois jours, le rattrapage est correct.
 */
registerJob({
  name: 'expiration-annonces',
  schedule: '0 3 * * *',
  async run({ prisma, logger }) {
    const instant = now();

    const { count } = await prisma.listing.updateMany({
      where: { status: 'PUBLISHED', expiresAt: { lte: instant }, deletedAt: null },
      data: { status: 'EXPIRED' },
    });

    if (count > 0) logger.info({ count }, 'annonces expirées');
  },
});

/**
 * Photos téléversées mais jamais rattachées à une annonce : un dépôt abandonné
 * en cours de route en laisse derrière lui. Sans cette purge, le stockage
 * grossit indéfiniment et l'on conserve des images dont personne ne veut.
 */
registerJob({
  name: 'purge-images-orphelines',
  schedule: '30 3 * * *',
  async run({ prisma, logger }) {
    const cutoff = addDays(now(), -1);

    const { count } = await prisma.listingImage.deleteMany({
      where: { listingId: null, createdAt: { lt: cutoff } },
    });

    if (count > 0) logger.info({ count }, 'images orphelines supprimées');
  },
});

/**
 * Purge des annonces supprimées, passé le délai de conservation. La suppression
 * est réelle : rien n'impose de garder une annonce retirée par son auteur.
 */
registerJob({
  name: 'purge-annonces-supprimees',
  schedule: '0 4 * * *',
  async run({ prisma, logger }) {
    const cutoff = addDays(now(), -RETENTION_DAYS.deletedListing);

    const { count } = await prisma.listing.deleteMany({
      where: { status: 'DELETED', deletedAt: { lt: cutoff } },
    });

    if (count > 0) logger.info({ count }, 'annonces supprimées purgées');
  },
});

/**
 * Purge des annonces expirées depuis longtemps, et des vues associées.
 */
registerJob({
  name: 'purge-annonces-expirees',
  schedule: '15 4 * * *',
  async run({ prisma, logger }) {
    const cutoff = addDays(now(), -RETENTION_DAYS.expiredListing);

    const { count } = await prisma.listing.deleteMany({
      where: { status: 'EXPIRED', updatedAt: { lt: cutoff } },
    });

    if (count > 0) logger.info({ count }, 'annonces expirées purgées');
  },
});

/**
 * Le quota mensuel est recalculé à la demande depuis les données ; rien n'est
 * à remettre à zéro. Cette tâche ne sert qu'à laisser une trace du passage du
 * mois, utile quand on relit les journaux après coup.
 */
registerJob({
  name: 'bascule-quota-mensuel',
  schedule: '0 0 1 * *',
  run({ logger }) {
    logger.info(
      { lifetimeDays: LISTING_LIMITS.publishedLifetimeDays },
      'nouveau mois : les quotas repartent de zéro',
    );
    return Promise.resolve();
  },
});
