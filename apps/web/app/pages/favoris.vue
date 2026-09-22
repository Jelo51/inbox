<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import type { ListingCardItem } from '~/components/listing/ListingCard.vue';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const localePath = useLocalePath();
const auth = useAuthStore();

const items = ref<ListingCardItem[]>([]);
const loading = ref(true);

useHead({ title: () => `${t('listing.favorites.title')} — ${t('app.name')}` });

onMounted(async () => {
  try {
    items.value = (await auth.authedRequest<{ items: ListingCardItem[] }>('/favorites')).items;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="shell py-8">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('listing.favorites.title') }}</h1>

    <p v-if="loading" class="mt-6 text-sm text-muted">{{ t('common.loading') }}</p>

    <ListingGrid v-else-if="items.length" :items="items" class="mt-6" />

    <div v-else class="card-surface mt-6 p-8 text-center">
      <p class="text-sm text-muted">{{ t('listing.favorites.empty') }}</p>
      <NuxtLink :to="localePath('/recherche')" class="btn-primary mt-4">
        {{ t('listing.search.submit') }}
      </NuxtLink>
    </div>
  </div>
</template>
