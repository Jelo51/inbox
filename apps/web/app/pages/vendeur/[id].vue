<script setup lang="ts">
import { BadgeCheck, MapPin } from 'lucide-vue-next';
import { useApiClient } from '~/composables/useApiClient';
import { useFormat } from '~/composables/useFormat';
import type { ListingCardItem } from '~/components/listing/ListingCard.vue';

interface SellerProfile {
  id: string;
  displayName: string;
  isPro: boolean;
  bio: string | null;
  memberSince: string;
  cityName: string | null;
  listingCount: number;
}

const { t } = useI18n();
const route = useRoute();
const api = useApiClient();
const format = useFormat();

const { data, error } = await useAsyncData(`vendeur-${route.params.id}`, () =>
  api.request<{ seller: SellerProfile; items: ListingCardItem[] }>(`/sellers/${route.params.id}`),
);

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Vendeur introuvable', fatal: true });
}

useHead(() => ({
  title: data.value
    ? `${t('listing.seller.title', { name: data.value.seller.displayName })} — ${t('app.name')}`
    : t('app.name'),
}));
</script>

<template>
  <div v-if="data" class="shell py-8">
    <header class="card-surface p-5">
      <h1 class="flex items-center gap-2 text-xl font-bold">
        {{ data.seller.displayName }}
        <BadgeCheck
          v-if="data.seller.isPro"
          class="h-5 w-5 text-orange"
          :aria-label="t('listing.card.pro')"
        />
      </h1>

      <p class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-grey">
        <span v-if="data.seller.cityName" class="inline-flex items-center gap-1">
          <MapPin class="h-4 w-4" aria-hidden="true" />{{ data.seller.cityName }}
        </span>
        <span>
          {{ t('listing.detail.memberSince', { date: format.monthYear(data.seller.memberSince) }) }}
        </span>
        <span class="tabular">
          {{ t('listing.seller.listingCount', data.seller.listingCount) }}
        </span>
      </p>

      <p v-if="data.seller.bio" class="mt-3 text-sm leading-relaxed text-muted">
        {{ data.seller.bio }}
      </p>
    </header>

    <ListingGrid v-if="data.items.length" :items="data.items" class="mt-6" />
  </div>
</template>
