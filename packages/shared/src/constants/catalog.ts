import type { Locale } from './enums.js';

export interface CategorySeed {
  slug: string;
  name: Record<Locale, string>;
  /** Nom d'icône lucide (lucide-vue-next) ; aucun emoji nulle part. */
  icon: string;
  position: number;
}

export const CATEGORIES: readonly CategorySeed[] = [
  {
    slug: 'telephones',
    name: { fr: 'Téléphones', en: 'Phones' },
    icon: 'smartphone',
    position: 1,
  },
  {
    slug: 'electronique',
    name: { fr: 'Électronique', en: 'Electronics' },
    icon: 'monitor',
    position: 2,
  },
  { slug: 'vehicules', name: { fr: 'Véhicules', en: 'Vehicles' }, icon: 'car', position: 3 },
  {
    slug: 'immobilier',
    name: { fr: 'Immobilier', en: 'Real estate' },
    icon: 'building-2',
    position: 4,
  },
  { slug: 'mode', name: { fr: 'Mode', en: 'Fashion' }, icon: 'shirt', position: 5 },
  { slug: 'maison', name: { fr: 'Maison', en: 'Home' }, icon: 'sofa', position: 6 },
  {
    slug: 'emploi-services',
    name: { fr: 'Emploi & Services', en: 'Jobs & Services' },
    icon: 'briefcase',
    position: 7,
  },
  { slug: 'loisirs', name: { fr: 'Loisirs', en: 'Leisure' }, icon: 'gamepad-2', position: 8 },
] as const;

export interface CitySeed {
  slug: string;
  name: string;
  region: Record<Locale, string>;
  position: number;
}

export const CITIES: readonly CitySeed[] = [
  { slug: 'douala', name: 'Douala', region: { fr: 'Littoral', en: 'Littoral' }, position: 1 },
  { slug: 'yaounde', name: 'Yaoundé', region: { fr: 'Centre', en: 'Centre' }, position: 2 },
  { slug: 'bafoussam', name: 'Bafoussam', region: { fr: 'Ouest', en: 'West' }, position: 3 },
  { slug: 'bamenda', name: 'Bamenda', region: { fr: 'Nord-Ouest', en: 'North-West' }, position: 4 },
  { slug: 'garoua', name: 'Garoua', region: { fr: 'Nord', en: 'North' }, position: 5 },
  { slug: 'kribi', name: 'Kribi', region: { fr: 'Sud', en: 'South' }, position: 6 },
  { slug: 'buea', name: 'Buea', region: { fr: 'Sud-Ouest', en: 'South-West' }, position: 7 },
  { slug: 'limbe', name: 'Limbé', region: { fr: 'Sud-Ouest', en: 'South-West' }, position: 8 },
  {
    slug: 'ngaoundere',
    name: 'Ngaoundéré',
    region: { fr: 'Adamaoua', en: 'Adamawa' },
    position: 9,
  },
  { slug: 'maroua', name: 'Maroua', region: { fr: 'Extrême-Nord', en: 'Far North' }, position: 10 },
  { slug: 'bertoua', name: 'Bertoua', region: { fr: 'Est', en: 'East' }, position: 11 },
  { slug: 'ebolowa', name: 'Ebolowa', region: { fr: 'Sud', en: 'South' }, position: 12 },
] as const;

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);
export const CITY_SLUGS = CITIES.map((c) => c.slug);
