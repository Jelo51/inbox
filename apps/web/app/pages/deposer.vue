<script setup lang="ts">
import { CircleCheck } from 'lucide-vue-next';
import { LISTING_CONDITIONS, PRICE_UNITS } from '@inbox/shared';
import { useAuthStore } from '~/stores/auth';
import { useCatalog } from '~/composables/useCatalog';
import { useApiError } from '~/composables/useApiError';
import type { UploadedImage } from '~/components/listing/ImageUploader.vue';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const localePath = useLocalePath();
const auth = useAuthStore();
const { categories, cities, categoryName } = useCatalog();
const apiError = useApiError();

interface Quota {
  limit: number | null;
  used: number;
  remaining: number | null;
}

const quota = ref<Quota | null>(null);
const images = ref<UploadedImage[]>([]);
const submitting = ref(false);
const submitted = ref(false);
const error = ref<unknown>(null);

const form = reactive({
  title: '',
  description: '',
  price: '',
  priceUnit: 'NONE',
  categorySlug: '',
  citySlug: '',
  neighbourhood: '',
  condition: 'GOOD',
});

useHead({ title: () => `${t('listing.publish.title')} — ${t('app.name')}` });

onMounted(async () => {
  quota.value = (await auth.authedRequest<{ quota: Quota }>('/listings/quota')).quota;
});

const quotaExhausted = computed(
  () => quota.value?.remaining !== null && (quota.value?.remaining ?? 1) <= 0,
);

const canSubmit = computed(
  () => images.value.length > 0 && !submitting.value && !quotaExhausted.value,
);

async function submit(asDraft = false) {
  submitting.value = true;
  error.value = null;

  try {
    await auth.authedRequest('/listings', {
      method: 'POST',
      query: asDraft ? { draft: 'true' } : undefined,
      body: {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        priceUnit: form.priceUnit,
        categorySlug: form.categorySlug,
        citySlug: form.citySlug,
        ...(form.neighbourhood.trim() && { neighbourhood: form.neighbourhood.trim() }),
        condition: form.condition,
        imageIds: images.value.map((image) => image.id),
      },
    });
    submitted.value = true;
  } catch (err) {
    error.value = err;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="shell max-w-2xl py-8">
    <template v-if="submitted">
      <div class="card-surface flex flex-col items-center p-8 text-center">
        <CircleCheck class="h-12 w-12 text-success" aria-hidden="true" />
        <h1 class="mt-4 text-xl font-bold">{{ t('listing.publish.pendingTitle') }}</h1>
        <p class="mt-2 max-w-md text-sm leading-relaxed text-muted">
          {{ t('listing.publish.pendingText') }}
        </p>
        <NuxtLink :to="localePath('/compte/annonces')" class="btn-primary mt-6">
          {{ t('listing.publish.seeMyListings') }}
        </NuxtLink>
      </div>
    </template>

    <template v-else>
      <h1 class="text-2xl font-bold tracking-tight">{{ t('listing.publish.title') }}</h1>

      <p v-if="quota && quota.limit === null" class="mt-2 text-sm text-success">
        {{ t('listing.publish.quotaUnlimited') }}
      </p>
      <p v-else-if="quota && !quotaExhausted" class="tabular mt-2 text-sm text-muted">
        {{ t('listing.publish.quotaLeft', quota.remaining ?? 0) }}
      </p>

      <AppAlert v-if="quotaExhausted" tone="warning" class="mt-4">
        <p>{{ t('listing.publish.quotaExhausted') }}</p>
        <NuxtLink :to="localePath('/pro')" class="btn-primary mt-3">
          {{ t('listing.publish.quotaProLink') }}
        </NuxtLink>
      </AppAlert>

      <AppAlert v-if="error" tone="error" class="mt-4">{{ apiError.message(error) }}</AppAlert>

      <form
        class="card-surface mt-6 flex flex-col gap-5 p-5"
        novalidate
        @submit.prevent="submit(false)"
      >
        <FormField
          id="photos"
          :label="t('listing.publish.photos')"
          :hint="t('listing.publish.photosHint')"
          required
        >
          <ImageUploader v-model="images" />
        </FormField>

        <FormField
          id="titre"
          :label="t('listing.publish.listingTitle')"
          :hint="t('listing.publish.titleHint')"
          :error="apiError.fieldError(error, 'title')"
          required
        >
          <template #default="{ describedBy, invalid }">
            <input
              id="titre"
              v-model="form.title"
              type="text"
              class="field"
              :class="invalid ? 'border-danger' : ''"
              maxlength="90"
              required
              :aria-describedby="describedBy"
            />
          </template>
        </FormField>

        <FormField
          id="description"
          :label="t('listing.publish.description')"
          :hint="t('listing.publish.descriptionHint')"
          :error="apiError.fieldError(error, 'description')"
          required
        >
          <template #default="{ describedBy, invalid }">
            <textarea
              id="description"
              v-model="form.description"
              rows="7"
              class="field py-2"
              :class="invalid ? 'border-danger' : ''"
              maxlength="4000"
              required
              :aria-describedby="describedBy"
            />
          </template>
        </FormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            id="prix"
            :label="t('listing.publish.price')"
            :error="apiError.fieldError(error, 'price')"
            required
          >
            <template #default="{ describedBy, invalid }">
              <input
                id="prix"
                v-model="form.price"
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                class="field tabular"
                :class="invalid ? 'border-danger' : ''"
                required
                :aria-describedby="describedBy"
              />
            </template>
          </FormField>

          <FormField id="unite" :label="t('listing.publish.priceUnit')">
            <template #default="{ describedBy }">
              <select
                id="unite"
                v-model="form.priceUnit"
                class="field"
                :aria-describedby="describedBy"
              >
                <option v-for="unit in PRICE_UNITS" :key="unit" :value="unit">
                  {{ unit === 'NONE' ? '—' : t(`listing.priceUnit.${unit}`) }}
                </option>
              </select>
            </template>
          </FormField>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            id="categorie"
            :label="t('listing.publish.category')"
            :error="apiError.fieldError(error, 'categorySlug')"
            required
          >
            <template #default="{ describedBy }">
              <select
                id="categorie"
                v-model="form.categorySlug"
                class="field"
                required
                :aria-describedby="describedBy"
              >
                <option value="" disabled>—</option>
                <option v-for="c in categories" :key="c.slug" :value="c.slug">
                  {{ categoryName(c) }}
                </option>
              </select>
            </template>
          </FormField>

          <FormField
            id="ville"
            :label="t('listing.publish.city')"
            :error="apiError.fieldError(error, 'citySlug')"
            required
          >
            <template #default="{ describedBy }">
              <select
                id="ville"
                v-model="form.citySlug"
                class="field"
                required
                :aria-describedby="describedBy"
              >
                <option value="" disabled>—</option>
                <option v-for="c in cities" :key="c.slug" :value="c.slug">{{ c.name }}</option>
              </select>
            </template>
          </FormField>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            id="quartier"
            :label="t('listing.publish.neighbourhood')"
            :optional-label="t('common.optional')"
          >
            <template #default="{ describedBy }">
              <input
                id="quartier"
                v-model="form.neighbourhood"
                type="text"
                class="field"
                maxlength="60"
                :aria-describedby="describedBy"
              />
            </template>
          </FormField>

          <FormField id="etat" :label="t('listing.publish.condition')">
            <template #default="{ describedBy }">
              <select
                id="etat"
                v-model="form.condition"
                class="field"
                :aria-describedby="describedBy"
              >
                <option v-for="c in LISTING_CONDITIONS" :key="c" :value="c">
                  {{ t(`listing.condition.${c}`) }}
                </option>
              </select>
            </template>
          </FormField>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row">
          <button type="submit" class="btn-primary flex-1" :disabled="!canSubmit">
            {{ submitting ? t('common.loading') : t('listing.publish.submit') }}
          </button>
          <button type="button" class="btn-secondary" :disabled="!canSubmit" @click="submit(true)">
            {{ t('listing.publish.saveDraft') }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>
