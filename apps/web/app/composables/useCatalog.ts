import { useApiClient } from '~/composables/useApiClient';

export interface Category {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  icon: string;
  position: number;
}

export interface City {
  id: string;
  slug: string;
  name: string;
  regionFr: string;
  regionEn: string;
  position: number;
}

/**
 * Catégories et villes. Elles changent rarement : une seule requête par rendu,
 * mise en cache par `useAsyncData` sous une clé stable.
 */
export function useCatalog() {
  const api = useApiClient();
  const { locale } = useI18n();

  const { data, pending, error } = useAsyncData('catalogue', () =>
    api.request<{ categories: Category[]; cities: City[] }>('/catalog'),
  );

  const categories = computed(() => data.value?.categories ?? []);
  const cities = computed(() => data.value?.cities ?? []);

  function categoryName(category: Pick<Category, 'nameFr' | 'nameEn'>): string {
    return locale.value === 'en' ? category.nameEn : category.nameFr;
  }

  function regionName(city: Pick<City, 'regionFr' | 'regionEn'>): string {
    return locale.value === 'en' ? city.regionEn : city.regionFr;
  }

  return { categories, cities, categoryName, regionName, pending, error };
}
