import type { PrismaClient } from '@prisma/client';
import { CATEGORIES, CITIES } from '@inbox/shared';

/** Catalogue de référence : idempotent, rejouable à chaque démarrage. */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        nameFr: category.name.fr,
        nameEn: category.name.en,
        icon: category.icon,
        position: category.position,
      },
      create: {
        slug: category.slug,
        nameFr: category.name.fr,
        nameEn: category.name.en,
        icon: category.icon,
        position: category.position,
      },
    });
  }

  for (const city of CITIES) {
    await prisma.city.upsert({
      where: { slug: city.slug },
      update: {
        name: city.name,
        regionFr: city.region.fr,
        regionEn: city.region.en,
        position: city.position,
      },
      create: {
        slug: city.slug,
        name: city.name,
        regionFr: city.region.fr,
        regionEn: city.region.en,
        position: city.position,
      },
    });
  }

  // Le prix vit en base : le changer ne demande aucun déploiement.
  await prisma.plan.upsert({
    where: { code: 'PRO_MENSUEL' },
    update: {},
    create: {
      code: 'PRO_MENSUEL',
      nameFr: 'Inbox Pro — mensuel',
      nameEn: 'Inbox Pro — monthly',
      priceXaf: 7500,
      // Reste à 0 tant que l'assujettissement à la TVA de l'éditeur n'est pas
      // établi (l'éditeur n'est pas encore immatriculé au Cameroun).
      vatRateBp: 0,
      periodDays: 30,
      isActive: true,
    },
  });
}
