interface SitemapListing {
  id: string;
  slug: string;
  publishedAt: string | null;
}

/**
 * Plan du site : les pages fixes, puis les annonces publiées. Il est régénéré
 * à la demande et mis en cache une heure — une annonce de plus ne justifie pas
 * de reconstruire le fichier à chaque requête d'un robot.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl.replace(/\/$/, '');

  const staticPaths = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/recherche', priority: '0.8', changefreq: 'daily' },
    { path: '/pro', priority: '0.6', changefreq: 'monthly' },
    { path: '/securite', priority: '0.6', changefreq: 'monthly' },
    { path: '/aide', priority: '0.5', changefreq: 'monthly' },
    { path: '/contact', priority: '0.4', changefreq: 'yearly' },
    { path: '/legal/mentions-legales', priority: '0.3', changefreq: 'yearly' },
    { path: '/legal/conditions-generales', priority: '0.3', changefreq: 'yearly' },
    { path: '/legal/conditions-de-vente', priority: '0.3', changefreq: 'yearly' },
    { path: '/legal/confidentialite', priority: '0.3', changefreq: 'yearly' },
    { path: '/legal/cookies', priority: '0.3', changefreq: 'yearly' },
    { path: '/legal/regles-de-publication', priority: '0.3', changefreq: 'yearly' },
  ];

  let listings: SitemapListing[] = [];
  try {
    const response = await $fetch<{ items: SitemapListing[] }>(
      `${config.public.apiBase}/listings`,
      {
        query: { limit: 60, sort: 'recent' },
      },
    );
    listings = response.items;
  } catch {
    // Une API indisponible ne doit pas rendre le plan du site invalide : on
    // sert les pages fixes plutôt qu'une erreur 500.
  }

  const entries = [
    ...staticPaths.map((page) => ({
      loc: `${siteUrl}${page.path}`,
      alternate: `${siteUrl}/en${page.path === '/' ? '' : page.path}`,
      priority: page.priority,
      changefreq: page.changefreq,
      lastmod: null as string | null,
    })),
    ...listings.map((listing) => ({
      loc: `${siteUrl}/annonce/${listing.slug}-${listing.id}`,
      alternate: `${siteUrl}/en/annonce/${listing.slug}-${listing.id}`,
      priority: '0.7',
      changefreq: 'weekly',
      lastmod: listing.publishedAt,
    })),
  ];

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  setHeader(event, 'Cache-Control', 'public, max-age=3600');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map(
    (entry) => `  <url>
    <loc>${entry.loc}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod.slice(0, 10)}</lastmod>` : ''}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
    <xhtml:link rel="alternate" hreflang="fr" href="${entry.loc}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${entry.alternate}"/>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
});
