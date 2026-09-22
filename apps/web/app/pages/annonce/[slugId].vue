<script setup lang="ts">
import { BadgeCheck, Eye, Flag, Heart, MapPin, MessageSquare, Phone } from 'lucide-vue-next';
import { extractIdFromSlug, type PriceUnit } from '@inbox/shared';
import { ApiError, useApiClient } from '~/composables/useApiClient';
import { useFormat } from '~/composables/useFormat';
import { useAuthStore } from '~/stores/auth';

interface ListingDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  priceUnit: PriceUnit;
  condition: string;
  status: string;
  neighbourhood: string | null;
  publishedAt: string | null;
  viewCount: number;
  city: { slug: string; name: string };
  category: { slug: string; nameFr: string; nameEn: string };
  images: { id: string; url: string; thumbUrl: string; width: number; height: number }[];
  seller: {
    id: string;
    displayName: string;
    isPro: boolean;
    memberSince: string;
    bio: string | null;
    cityName: string | null;
    phonePreview: string | null;
  };
  isFavorite: boolean;
  isOwner: boolean;
}

const { t, locale } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const api = useApiClient();
const auth = useAuthStore();
const format = useFormat();
const config = useRuntimeConfig();

const listingId = computed(() => extractIdFromSlug(String(route.params.slugId ?? '')));

/**
 * Identifiant de session anonyme pour dédoublonner le compteur de vues. Il ne
 * contient aucune donnée personnelle et ne sert qu'à cela.
 */
const viewSession = useCookie<string>('inbox_vue', {
  maxAge: 60 * 60 * 24,
  sameSite: 'lax',
  secure: import.meta.env.PROD,
});
if (import.meta.client && !viewSession.value) {
  viewSession.value = Math.random().toString(36).slice(2);
}

const { data, error } = await useAsyncData(`annonce-${listingId.value}`, () => {
  if (!listingId.value) throw createError({ statusCode: 404, fatal: true });
  return api.request<{ listing: ListingDetail }>(`/listings/${listingId.value}`, {
    query: { sid: viewSession.value ?? undefined },
  });
});

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Annonce introuvable', fatal: true });
}

const listing = computed(() => data.value?.listing);
const activeImage = ref(0);
const currentImage = computed(() => listing.value?.images[activeImage.value] ?? null);
const isFavorite = ref(false);
const phone = ref<string | null>(null);
const phonePending = ref(false);

watchEffect(() => {
  if (listing.value) isFavorite.value = listing.value.isFavorite;
});

const canonical = computed(() =>
  listing.value
    ? `${config.public.siteUrl}${localePath(`/annonce/${listing.value.slug}-${listing.value.id}`)}`
    : config.public.siteUrl,
);

const categoryLabel = computed(() =>
  listing.value
    ? locale.value === 'en'
      ? listing.value.category.nameEn
      : listing.value.category.nameFr
    : '',
);

/**
 * Données structurées `Product` : c'est ce qui permet à un moteur d'afficher le
 * prix et la disponibilité directement dans ses résultats.
 */
const structuredData = computed(() => {
  if (!listing.value) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.value.title,
    description: listing.value.description.slice(0, 500),
    image: listing.value.images.map((i) => i.url),
    category: categoryLabel.value,
    offers: {
      '@type': 'Offer',
      price: listing.value.price,
      priceCurrency: 'XAF',
      availability:
        listing.value.status === 'SOLD'
          ? 'https://schema.org/SoldOut'
          : 'https://schema.org/InStock',
      url: canonical.value,
      areaServed: listing.value.city.name,
      seller: { '@type': 'Person', name: listing.value.seller.displayName },
    },
  };
});

useHead(() => ({
  title: listing.value ? `${listing.value.title} — ${t('app.name')}` : t('app.name'),
  link: [{ rel: 'canonical', href: canonical.value }],
  meta: listing.value
    ? [
        { name: 'description', content: listing.value.description.slice(0, 160) },
        { property: 'og:type', content: 'product' },
        { property: 'og:title', content: listing.value.title },
        { property: 'og:description', content: listing.value.description.slice(0, 200) },
        { property: 'og:url', content: canonical.value },
        { property: 'og:locale', content: locale.value === 'en' ? 'en_CM' : 'fr_CM' },
        ...(listing.value.images[0]
          ? [{ property: 'og:image', content: listing.value.images[0].url }]
          : []),
        { property: 'product:price:amount', content: String(listing.value.price) },
        { property: 'product:price:currency', content: 'XAF' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ]
    : [],
  script: structuredData.value
    ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(structuredData.value) }]
    : [],
}));

async function toggleFavorite() {
  if (!listing.value) return;
  if (!auth.isAuthenticated) {
    await navigateTo({ path: localePath('/connexion'), query: { suite: route.fullPath } });
    return;
  }

  const method = isFavorite.value ? 'DELETE' : 'PUT';
  await auth.authedRequest(`/listings/${listing.value.id}/favorite`, { method });
  isFavorite.value = !isFavorite.value;
}

async function revealPhone() {
  if (!listing.value || phonePending.value) return;
  phonePending.value = true;
  try {
    const res = await api.request<{ phone: string }>(`/listings/${listing.value.id}/phone`, {
      method: 'POST',
      accessToken: auth.accessToken,
    });
    phone.value = res.phone;
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      phone.value = null;
    }
  } finally {
    phonePending.value = false;
  }
}
</script>

<template>
  <article v-if="listing" class="shell py-6">
    <nav class="mb-4 text-sm" :aria-label="t('listing.detail.backToResults')">
      <NuxtLink
        :to="localePath({ path: '/recherche', query: { category: listing.category.slug } })"
        class="text-muted hover:text-orange-hover"
      >
        {{ categoryLabel }}
      </NuxtLink>
    </nav>

    <div class="lg:grid lg:grid-cols-[1fr_340px] lg:gap-8">
      <div>
        <!-- Galerie -->
        <div class="card-surface overflow-hidden">
          <div class="aspect-[4/3] w-full bg-canvas">
            <ListingPhoto
              :src="currentImage?.url ?? null"
              :seed="listing.id"
              contain
              :alt="
                t('listing.detail.photoOf', {
                  index: activeImage + 1,
                  total: listing.images.length,
                  title: listing.title,
                })
              "
            />
          </div>

          <ul v-if="listing.images.length > 1" class="flex gap-2 overflow-x-auto p-3">
            <li v-for="(image, index) in listing.images" :key="image.id">
              <button
                type="button"
                class="h-16 w-16 shrink-0 overflow-hidden rounded border-2 transition-colors"
                :class="index === activeImage ? 'border-orange' : 'border-line'"
                :aria-label="
                  t('listing.detail.photoOf', {
                    index: index + 1,
                    total: listing.images.length,
                    title: listing.title,
                  })
                "
                :aria-current="index === activeImage ? 'true' : undefined"
                @click="activeImage = index"
              >
                <img
                  :src="image.thumbUrl"
                  alt=""
                  class="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            </li>
          </ul>
        </div>

        <!-- Titre et prix -->
        <header class="mt-5">
          <p class="tabular text-2xl font-bold text-ink md:text-3xl">
            {{ format.price(listing.price, listing.priceUnit) }}
          </p>
          <h1 class="mt-2 text-xl font-bold leading-snug md:text-2xl">{{ listing.title }}</h1>

          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-grey">
            <span class="inline-flex items-center gap-1">
              <MapPin class="h-4 w-4" aria-hidden="true" />
              {{ listing.city.name
              }}<template v-if="listing.neighbourhood">, {{ listing.neighbourhood }}</template>
            </span>
            <span v-if="listing.publishedAt">
              {{ t('listing.detail.publishedOn', { date: format.date(listing.publishedAt) }) }}
            </span>
            <span class="tabular inline-flex items-center gap-1">
              <Eye class="h-4 w-4" aria-hidden="true" />
              {{ t('listing.card.views', listing.viewCount) }}
            </span>
          </div>
        </header>

        <!-- Description -->
        <section class="mt-6">
          <h2 class="text-base font-bold">{{ t('listing.detail.description') }}</h2>
          <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
            {{ listing.description }}
          </p>
        </section>

        <dl class="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt class="font-semibold text-ink">{{ t('listing.detail.condition') }}</dt>
            <dd class="mt-0.5 text-muted">{{ t(`listing.condition.${listing.condition}`) }}</dd>
          </div>
          <div>
            <dt class="font-semibold text-ink">{{ t('listing.detail.location') }}</dt>
            <dd class="mt-0.5 text-muted">{{ listing.city.name }}</dd>
          </div>
          <div>
            <dt class="font-semibold text-ink">{{ t('listing.detail.reference') }}</dt>
            <dd class="tabular mt-0.5 text-xs text-muted">
              {{ listing.id.slice(-8).toUpperCase() }}
            </dd>
          </div>
        </dl>
      </div>

      <!-- Colonne latérale : vendeur et actions -->
      <aside class="mt-8 lg:mt-0">
        <div class="card-surface p-4 lg:sticky lg:top-20">
          <h2 class="text-sm font-semibold text-grey">{{ t('listing.detail.seller') }}</h2>

          <p class="mt-2 flex items-center gap-1.5 font-semibold">
            {{ listing.seller.displayName }}
            <BadgeCheck
              v-if="listing.seller.isPro"
              class="h-4 w-4 text-orange"
              :aria-label="t('listing.card.pro')"
            />
          </p>
          <p class="mt-1 text-xs text-grey">
            {{
              t('listing.detail.memberSince', {
                date: format.monthYear(listing.seller.memberSince),
              })
            }}
          </p>

          <div class="mt-4 flex flex-col gap-2">
            <NuxtLink
              v-if="!listing.isOwner"
              :to="localePath({ path: '/messages/nouveau', query: { annonce: listing.id } })"
              class="btn-primary w-full"
            >
              <MessageSquare class="h-4 w-4" aria-hidden="true" />
              {{ t('listing.detail.writeToSeller') }}
            </NuxtLink>

            <button
              v-if="listing.seller.phonePreview && !phone"
              type="button"
              class="btn-secondary w-full"
              :disabled="phonePending"
              @click="revealPhone"
            >
              <Phone class="h-4 w-4" aria-hidden="true" />
              <span class="tabular">{{ listing.seller.phonePreview }}</span>
              <span>· {{ t('listing.detail.showPhone') }}</span>
            </button>
            <a v-else-if="phone" :href="`tel:+237${phone}`" class="btn-secondary tabular w-full">
              <Phone class="h-4 w-4" aria-hidden="true" />
              +237 {{ phone.slice(0, 3) }} {{ phone.slice(3, 5) }} {{ phone.slice(5, 7) }}
              {{ phone.slice(7, 9) }}
            </a>

            <button type="button" class="btn-secondary w-full" @click="toggleFavorite">
              <Heart
                class="h-4 w-4"
                :class="isFavorite ? 'fill-current text-danger' : ''"
                aria-hidden="true"
              />
              {{
                isFavorite ? t('listing.detail.removeFavorite') : t('listing.detail.addFavorite')
              }}
            </button>

            <NuxtLink :to="localePath(`/vendeur/${listing.seller.id}`)" class="btn-ghost w-full">
              {{ t('listing.detail.seeSellerListings') }}
            </NuxtLink>
          </div>
        </div>

        <AppAlert tone="warning" class="mt-4" :title="t('listing.detail.safetyTitle')">
          <p>{{ t('listing.detail.safetyText') }}</p>
          <NuxtLink
            :to="localePath('/securite')"
            class="mt-2 inline-block font-semibold text-orange-hover hover:underline"
          >
            {{ t('listing.detail.safetyLink') }}
          </NuxtLink>
        </AppAlert>

        <NuxtLink
          :to="localePath({ path: '/signaler', query: { type: 'LISTING', id: listing.id } })"
          class="btn-ghost mt-3 w-full text-xs"
        >
          <Flag class="h-3.5 w-3.5" aria-hidden="true" />
          {{ t('listing.detail.report') }}
        </NuxtLink>
      </aside>
    </div>
  </article>
</template>
