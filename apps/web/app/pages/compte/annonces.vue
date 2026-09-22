<script setup lang="ts">
import { Eye, Heart, MessageSquare, RefreshCw, Trash2 } from 'lucide-vue-next';
import { buildListingPath, type PriceUnit } from '@inbox/shared';
import { useAuthStore } from '~/stores/auth';
import { useFormat } from '~/composables/useFormat';

definePageMeta({ middleware: 'auth' });

interface MyListing {
  id: string;
  slug: string;
  title: string;
  price: number;
  priceUnit: PriceUnit;
  status: string;
  publishedAt: string | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  rejectionNote: string | null;
  viewCount: number;
  favoriteCount: number;
  contactCount: number;
  cityName: string;
  thumbUrl: string | null;
}

const { t } = useI18n();
const localePath = useLocalePath();
const auth = useAuthStore();
const format = useFormat();

const items = ref<MyListing[]>([]);
const loading = ref(true);

useHead({ title: () => `${t('listing.mine.title')} — ${t('app.name')}` });

async function load() {
  loading.value = true;
  try {
    items.value = (await auth.authedRequest<{ items: MyListing[] }>('/listings/mine')).items;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

/** Couleur du statut : elle double l'information, elle ne la porte pas seule. */
const statusTone: Record<string, string> = {
  PUBLISHED: 'bg-success/10 text-success',
  PENDING: 'bg-pending/10 text-pending',
  REJECTED: 'bg-danger/10 text-danger',
  EXPIRED: 'bg-canvas text-grey',
  SOLD: 'bg-canvas text-muted',
  DRAFT: 'bg-canvas text-grey',
};

async function renew(id: string) {
  await auth.authedRequest(`/listings/${id}/renew`, { method: 'POST' });
  await load();
}

async function markSold(id: string) {
  await auth.authedRequest(`/listings/${id}/status`, { method: 'POST', body: { status: 'SOLD' } });
  await load();
}

async function remove(id: string) {
  if (!globalThis.confirm(t('listing.mine.deleteConfirm'))) return;
  await auth.authedRequest(`/listings/${id}`, { method: 'DELETE' });
  await load();
}
</script>

<template>
  <div class="shell max-w-3xl py-8">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('listing.mine.title') }}</h1>

    <p v-if="loading" class="mt-6 text-sm text-muted">{{ t('common.loading') }}</p>

    <template v-else-if="items.length">
      <ul class="mt-6 space-y-3">
        <li v-for="item in items" :key="item.id" class="card-surface p-4">
          <div class="flex gap-4">
            <NuxtLink
              :to="localePath(buildListingPath(item.slug, item.id))"
              class="h-20 w-20 shrink-0 overflow-hidden rounded border border-line bg-canvas"
            >
              <img
                v-if="item.thumbUrl"
                :src="item.thumbUrl"
                :alt="item.title"
                class="h-full w-full object-cover"
                loading="lazy"
              />
            </NuxtLink>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <NuxtLink
                  :to="localePath(buildListingPath(item.slug, item.id))"
                  class="line-clamp-2 text-sm font-semibold hover:text-orange-hover"
                >
                  {{ item.title }}
                </NuxtLink>
                <span
                  class="shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold"
                  :class="statusTone[item.status] ?? 'bg-canvas text-grey'"
                >
                  {{ t(`listing.status.${item.status}`) }}
                </span>
              </div>

              <p class="tabular mt-1 text-sm font-bold">
                {{ format.price(item.price, item.priceUnit) }}
              </p>

              <p class="tabular mt-1 flex flex-wrap gap-x-3 text-xs text-grey">
                <span class="inline-flex items-center gap-1">
                  <Eye class="h-3.5 w-3.5" aria-hidden="true" />{{ item.viewCount }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <Heart class="h-3.5 w-3.5" aria-hidden="true" />{{ item.favoriteCount }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <MessageSquare class="h-3.5 w-3.5" aria-hidden="true" />{{ item.contactCount }}
                </span>
                <span v-if="item.expiresAt">
                  {{ t('listing.mine.expiresOn', { date: format.date(item.expiresAt) }) }}
                </span>
              </p>

              <AppAlert v-if="item.status === 'REJECTED'" tone="error" class="mt-3">
                <p class="font-medium">{{ t('listing.mine.rejectedFor') }}</p>
                <p class="mt-1">{{ item.rejectionNote ?? item.rejectionReason }}</p>
              </AppAlert>

              <div class="mt-3 flex flex-wrap gap-2">
                <NuxtLink
                  :to="localePath(`/compte/annonces/${item.id}`)"
                  class="btn-secondary text-xs"
                >
                  {{ t('listing.mine.edit') }}
                </NuxtLink>
                <button
                  v-if="item.status === 'PUBLISHED'"
                  type="button"
                  class="btn-secondary text-xs"
                  @click="renew(item.id)"
                >
                  <RefreshCw class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ t('listing.mine.renew') }}
                </button>
                <button
                  v-if="item.status === 'PUBLISHED'"
                  type="button"
                  class="btn-secondary text-xs"
                  @click="markSold(item.id)"
                >
                  {{ t('listing.mine.markSold') }}
                </button>
                <button
                  type="button"
                  class="btn-ghost text-xs text-danger"
                  @click="remove(item.id)"
                >
                  <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ t('listing.mine.delete') }}
                </button>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </template>

    <div v-else class="card-surface mt-6 p-8 text-center">
      <p class="text-sm text-muted">{{ t('listing.mine.empty') }}</p>
      <NuxtLink :to="localePath('/deposer')" class="btn-primary mt-4">
        {{ t('listing.mine.publishFirst') }}
      </NuxtLink>
    </div>
  </div>
</template>
