/**
 * Slug d'URL sans accent : `/annonce/[slug]-[id]`.
 * La normalisation NFD suivie du retrait des diacritiques donne le même
 * résultat côté serveur et côté navigateur.
 */
export function slugify(input: string, maxLength = 70): string {
  const base = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (base.length <= maxLength) return base || 'annonce';
  return (
    base
      .slice(0, maxLength)
      .replace(/-+[^-]*$/, '')
      .replace(/-+$/, '') || 'annonce'
  );
}

/** `iphone-13-pro-max-128go-clx9k2p0000008l3h4f5g6h7` → l'identifiant final. */
export function extractIdFromSlug(slugWithId: string): string | null {
  const lastDash = slugWithId.lastIndexOf('-');
  if (lastDash === -1) return slugWithId || null;
  const id = slugWithId.slice(lastDash + 1);
  return id.length > 0 ? id : null;
}

export function buildListingPath(slug: string, id: string): string {
  return `/annonce/${slug}-${id}`;
}
