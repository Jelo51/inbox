<script setup lang="ts">
import { Search, SlidersHorizontal } from 'lucide-vue-next';
import { LISTING_CONDITIONS } from '@inbox/shared';
import { useApiClient } from '~/composables/useApiClient';
import { useCatalog } from '~/composables/useCatalog';
import type { ListingCardItem } from '~/components/listing/ListingCard.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const api = useApiClient();
const { categories, cities, categoryName } = useCatalog();

interface SearchResponse {
  items: ListingCardItem[];
  nextCursor: string | null;
  total?: number;
}

/**
 * Les filtres vivent dans l'URL : une recherche est partageable, indexable, et
 * le bouton « retour » du navigateur fait ce qu'on attend de lui.
 */
const filters = reactive({
  q: (route.query.q as string) ?? '',
  category: (route.query.category as string) ?? '',
  city: (route.query.city as string) ?? '',
  priceMin: (route.query.priceMin as string) ?? '',
  priceMax: (route.query.priceMax as string) ?? '',
  condition: (route.query.condition as string) ?? '',
  sort: (route.query.sort as string) ?? 'recent',
});

const showFilters = ref(false);

function queryParams(cursor?: string) {
  return {
    ...(filters.q && { q: filters.q }),
    ...(filters.category && { category: filters.category }),
    ...(filters.city && { city: filters.city }),
    ...(filters.priceMin && { priceMin: filters.priceMin }),
    ...(filters.priceMax && { priceMax: filters.priceMax }),
    ...(filters.condition && { condition: filters.condition }),
    sort: filters.sort,
    limit: 24,
    ...(cursor && { cursor }),
  };
}

const { data, pending } = await useAsyncData(
  'recherche',
  () => api.request<SearchResponse>('/listings', { query: queryParams() }),
  { watch: [() => route.fullPath] },
);

const items = ref<ListingCardItem[]>([]);
const cursor = ref<string | null>(null);
const total = ref(0);
const loadingMore = ref(false);

watchEffect(() => {
  if (!data.value) return;
  items.value = data.value.items;
  cursor.value = data.value.nextCursor;
  total.value = data.value.total ?? items.value.length;
});

useHead({
  title: () =>
    filters.q
      ? `${filters.q} — ${t('listing.search.title')} — ${t('app.name')}`
      : `${t('listing.search.title')} — ${t('app.name')}`,
  // Les pages de résultats filtrées ne sont pas des pages à indexer : elles se
  // multiplient à l'infini et diluent le référencement des annonces.
  meta: [{ name: 'robots', content: 'noindex, follow' }],
});

function applyFilters() {
  showFilters.value = false;
  void router.push({ query: { ...queryParams(), limit: undefined } as never });
}

function resetFilters() {
  filters.q = '';
  filters.category = '';
  filters.city = '';
  filters.priceMin = '';
  filters.priceMax = '';
  filters.condition = '';
  filters.sort = 'recent';
  applyFilters();
}

async function loadMore() {
  if (!cursor.value || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const next = await api.request<SearchResponse>('/listings', {
      query: queryParams(cursor.value),
    });
    items.value = [...items.value, ...next.items];
    cursor.value = next.nextCursor;
  } finally {
    loadingMore.value = false;
  }
}
</script>

<template>
  <div class="shell py-6">
    <h1 class="sr-only">{{ t('listing.search.title') }}</h1>

    <form class="flex gap-2" role="search" @submit.prevent="applyFilters">
      <label for="recherche" class="sr-only">{{ t('listing.search.placeholder') }}</label>
      <div class="relative flex-1">
        <Search
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey"
          aria-hidden="true"
        />
        <input
          id="recherche"
          v-model="filters.q"
          type="search"
          class="field pl-9"
          :placeholder="t('listing.search.placeholder')"
        />
      </div>
      <button type="submit" class="btn-primary shrink-0">
        {{ t('listing.search.submit') }}
      </button>
      <button
        type="button"
        class="btn-secondary shrink-0 lg:hidden"
        :aria-expanded="showFilters"
        aria-controls="filtres"
        @click="showFilters = !showFilters"
      >
        <SlidersHorizontal class="h-4 w-4" aria-hidden="true" />
        <span class="sr-only sm:not-sr-only">{{ t('listing.search.filters') }}</span>
      </button>
    </form>

    <div class="mt-4 lg:grid lg:grid-cols-[260px_1fr] lg:gap-6">
      <aside
        id="filtres"
        class="card-surface p-4 lg:sticky lg:top-20 lg:block lg:self-start"
        :class="showFilters ? 'block' : 'hidden'"
        :aria-label="t('listing.search.filters')"
      >
        <div class="flex flex-col gap-4">
          <FormField id="categorie" :label="t('listing.search.category')">
            <template #default="{ describedBy }">
              <select
                id="categorie"
                v-model="filters.category"
                class="field"
                :aria-describedby="describedBy"
              >
                <option value="">{{ t('listing.search.allCategories') }}</option>
                <option v-for="c in categories" :key="c.slug" :value="c.slug">
                  {{ categoryName(c) }}
                </option>
              </select>
            </template>
          </FormField>

          <FormField id="ville" :label="t('listing.search.city')">
            <template #default="{ describedBy }">
              <select
                id="ville"
                v-model="filters.city"
                class="field"
                :aria-describedby="describedBy"
              >
                <option value="">{{ t('listing.search.allCities') }}</option>
                <option v-for="c in cities" :key="c.slug" :value="c.slug">{{ c.name }}</option>
              </select>
            </template>
          </FormField>

          <div class="grid grid-cols-2 gap-3">
            <FormField id="prix-min" :label="t('listing.search.priceMin')">
              <template #default="{ describedBy }">
                <input
                  id="prix-min"
                  v-model="filters.priceMin"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  class="field tabular"
                  :aria-describedby="describedBy"
                />
              </template>
            </FormField>
            <FormField id="prix-max" :label="t('listing.search.priceMax')">
              <template #default="{ describedBy }">
                <input
                  id="prix-max"
                  v-model="filters.priceMax"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  class="field tabular"
                  :aria-describedby="describedBy"
                />
              </template>
            </FormField>
          </div>

          <FormField id="etat" :label="t('listing.search.condition')">
            <template #default="{ describedBy }">
              <select
                id="etat"
                v-model="filters.condition"
                class="field"
                :aria-describedby="describedBy"
              >
                <option value="">—</option>
                <option v-for="c in LISTING_CONDITIONS" :key="c" :value="c">
                  {{ t(`listing.condition.${c}`) }}
                </option>
              </select>
            </template>
          </FormField>

          <FormField id="tri" :label="t('listing.search.sort')">
            <template #default="{ describedBy }">
              <select id="tri" v-model="filters.sort" class="field" :aria-describedby="describedBy">
                <option value="recent">{{ t('listing.search.sortRecent') }}</option>
                <option value="price_asc">{{ t('listing.search.sortPriceAsc') }}</option>
                <option value="price_desc">{{ t('listing.search.sortPriceDesc') }}</option>
              </select>
            </template>
          </FormField>

          <button type="button" class="btn-primary w-full" @click="applyFilters">
            {{ t('listing.search.apply') }}
          </button>
          <button type="button" class="btn-ghost w-full" @click="resetFilters">
            {{ t('listing.search.reset') }}
          </button>
        </div>
      </aside>

      <section class="mt-4 lg:mt-0">
        <p class="tabular text-sm text-muted" aria-live="polite">
          {{ t('listing.search.results', total) }}
        </p>

        <template v-if="items.length">
          <ListingGrid :items="items" class="mt-3" />

          <div v-if="cursor" class="mt-6 flex justify-center">
            <button type="button" class="btn-secondary" :disabled="loadingMore" @click="loadMore">
              {{ loadingMore ? t('common.loading') : t('listing.search.loadMore') }}
            </button>
          </div>
        </template>

        <AppAlert v-else-if="!pending" tone="info" class="mt-4">
          <p class="font-medium">{{ t('listing.search.noResults') }}</p>
          <p class="mt-1">{{ t('listing.search.noResultsHint') }}</p>
        </AppAlert>
      </section>
    </div>
  </div>
</template>
