<script setup lang="ts">
import { BadgeCheck, ImageOff } from 'lucide-vue-next';
import { buildListingPath, type PriceUnit } from '@inbox/shared';
import { useFormat } from '~/composables/useFormat';

export interface ListingCardItem {
  id: string;
  slug: string;
  title: string;
  price: number;
  priceUnit: PriceUnit;
  cityName: string;
  neighbourhood?: string | null;
  sellerIsPro?: boolean;
  publishedAt?: string | null;
  thumbUrl?: string | null;
}

defineProps<{ item: ListingCardItem }>();

const { t } = useI18n();
const localePath = useLocalePath();
const format = useFormat();
</script>

<template>
  <article class="card-surface group overflow-hidden transition-shadow hover:shadow-raised">
    <NuxtLink
      :to="localePath(buildListingPath(item.slug, item.id))"
      class="flex h-full flex-col focus-visible:outline-none"
    >
      <div class="relative aspect-[4/3] w-full overflow-hidden bg-canvas">
        <img
          v-if="item.thumbUrl"
          :src="item.thumbUrl"
          :alt="item.title"
          loading="lazy"
          decoding="async"
          class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
        <div v-else class="flex h-full w-full flex-col items-center justify-center gap-1 text-grey">
          <ImageOff class="h-6 w-6" aria-hidden="true" />
          <span class="text-xs">{{ t('listing.card.noPhoto') }}</span>
        </div>

        <p
          v-if="item.sellerIsPro"
          class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-card/95 px-2 py-0.5 text-[11px] font-semibold text-orange-hover shadow-card"
        >
          <BadgeCheck class="h-3 w-3" aria-hidden="true" />
          {{ t('listing.card.pro') }}
        </p>
      </div>

      <div class="flex flex-1 flex-col gap-1 p-3">
        <p class="tabular text-base font-bold leading-tight text-ink">
          {{ format.price(item.price, item.priceUnit) }}
        </p>
        <h3 class="line-clamp-2 text-sm leading-snug text-muted">{{ item.title }}</h3>
        <p class="mt-auto pt-2 text-xs text-grey">
          {{ item.cityName
          }}<template v-if="item.neighbourhood"> · {{ item.neighbourhood }}</template>
        </p>
      </div>
    </NuxtLink>
  </article>
</template>
