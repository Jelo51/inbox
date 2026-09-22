/**
 * Les pages de résultats filtrés sont exclues : elles se multiplient à l'infini
 * et diluent le référencement des annonces, qui sont le contenu utile.
 */
export default defineEventHandler((event) => {
  const siteUrl = useRuntimeConfig().public.siteUrl;

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
  setHeader(event, 'Cache-Control', 'public, max-age=3600');

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /compte',
    'Disallow: /messages',
    'Disallow: /admin',
    'Disallow: /deposer',
    'Disallow: /favoris',
    'Disallow: /recherche?',
    'Disallow: /connexion',
    'Disallow: /inscription',
    'Disallow: /nouveau-mot-de-passe',
    'Disallow: /verifier-email',
    'Disallow: /confirmer-email',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
});
