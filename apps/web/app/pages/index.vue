<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next';
import * as icons from 'lucide-vue-next';
import { useApiClient } from '~/composables/useApiClient';
import { useCatalog } from '~/composables/useCatalog';
import type { ListingCardItem } from '~/components/listing/ListingCard.vue';

const { t } = useI18n();
const localePath = useLocalePath();
const api = useApiClient();
const { categories, categoryName } = useCatalog();

const { data: recent } = await useAsyncData('accueil-annonces', () =>
  api.request<{ items: ListingCardItem[]; total: number }>('/listings', {
    query: { limit: 12, sort: 'recent' },
  }),
);

const config = useRuntimeConfig();

useHead({
  title: `${t('app.name')} — ${t('app.tagline')}`,
  meta: [
    { name: 'description', content: t('listing.home.heroText') },
    { property: 'og:title', content: `${t('app.name')} — ${t('app.tagline')}` },
    { property: 'og:description', content: t('listing.home.heroText') },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: config.public.siteUrl },
  ],
});

/**
 * Les icônes de catégorie sont nommées en base (`smartphone`, `car`…) : on
 * résout le composant lucide correspondant, avec un repli neutre.
 */
function categoryIcon(name: string) {
  const pascal = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return (icons as unknown as Record<string, unknown>)[pascal] ?? icons.Tag;
}
</script>

<template>
  <div>
    <section class="border-b border-line bg-card">
      <div class="shell py-10 md:py-14">
        <h1 class="max-w-2xl text-2xl font-bold leading-tight tracking-tight md:text-4xl">
          {{ t('listing.home.heroTitle') }}
        </h1>
        <p class="mt-3 max-w-xl text-sm leading-relaxed text-muted md:text-base">
          {{ t('listing.home.heroText') }}
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <NuxtLink :to="localePath('/recherche')" class="btn-primary">
            {{ t('listing.search.submit') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/deposer')" class="btn-secondary">
            {{ t('nav.publish') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="shell py-8">
      <h2 class="text-lg font-bold tracking-tight">{{ t('listing.home.browseCategories') }}</h2>
      <ul class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <li v-for="category in categories" :key="category.slug">
          <NuxtLink
            :to="localePath({ path: '/recherche', query: { category: category.slug } })"
            class="card-surface flex min-h-touch flex-col items-center gap-2 p-3 text-center transition-colors hover:border-orange"
          >
            <component
              :is="categoryIcon(category.icon)"
              class="h-6 w-6 text-orange"
              aria-hidden="true"
            />
            <span class="text-xs font-medium leading-tight">{{ categoryName(category) }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section class="shell pb-10">
      <div class="flex items-baseline justify-between gap-4">
        <h2 class="text-lg font-bold tracking-tight">{{ t('listing.home.recent') }}</h2>
        <NuxtLink
          :to="localePath('/recherche')"
          class="text-sm font-semibold text-orange-hover hover:underline"
        >
          {{ t('listing.home.seeAll') }}
        </NuxtLink>
      </div>

      <ListingGrid v-if="recent?.items?.length" :items="recent.items" class="mt-4" />

      <div class="card-surface mt-8 flex items-start gap-3 p-4">
        <ShieldCheck class="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
        <div class="text-sm leading-relaxed">
          <p class="font-semibold">{{ t('listing.detail.safetyTitle') }}</p>
          <p class="mt-1 text-muted">{{ t('listing.detail.safetyText') }}</p>
          <NuxtLink
            :to="localePath('/securite')"
            class="mt-2 inline-block font-semibold text-orange-hover hover:underline"
          >
            {{ t('listing.detail.safetyLink') }}
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
