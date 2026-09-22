<script setup lang="ts">
import { ImagePlus, Loader2, X } from 'lucide-vue-next';
import { LISTING_LIMITS } from '@inbox/shared';
import { useAuthStore } from '~/stores/auth';
import { useApiError } from '~/composables/useApiError';

export interface UploadedImage {
  id: string;
  url: string;
  thumbUrl: string;
}

const model = defineModel<UploadedImage[]>({ required: true });

const { t } = useI18n();
const auth = useAuthStore();
const config = useRuntimeConfig();
const apiError = useApiError();

const input = ref<HTMLInputElement>();
const uploading = ref(false);
const error = ref<string | null>(null);

const canAddMore = computed(() => model.value.length < LISTING_LIMITS.imagesMax);

/**
 * Le téléversement passe par l'API, jamais directement par le stockage : c'est
 * là que le type réel est vérifié et que les métadonnées EXIF, position GPS
 * comprise, sont retirées.
 */
async function handleFiles(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? []);
  if (files.length === 0) return;

  uploading.value = true;
  error.value = null;

  try {
    for (const file of files) {
      if (!canAddMore.value) break;

      const body = new FormData();
      body.append('file', file);

      const response = await fetch(`${config.public.apiBase}/images`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.accessToken ?? ''}` },
        credentials: 'include',
        body,
      });

      const payload = (await response.json()) as
        { image: UploadedImage } | { error: { code: string; message: string } };

      if (!response.ok) {
        error.value = 'error' in payload ? payload.error.message : apiError.message(null);
        break;
      }

      model.value = [...model.value, (payload as { image: UploadedImage }).image];
    }
  } finally {
    uploading.value = false;
    if (input.value) input.value.value = '';
  }
}

function remove(id: string) {
  model.value = model.value.filter((image) => image.id !== id);
}
</script>

<template>
  <div>
    <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4">
      <li v-for="(image, index) in model" :key="image.id" class="relative">
        <img
          :src="image.thumbUrl"
          :alt="t('listing.publish.photos') + ' ' + (index + 1)"
          class="aspect-square w-full rounded-card border border-line object-cover"
        />
        <button
          type="button"
          class="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white shadow-card"
          :aria-label="t('listing.publish.removePhoto')"
          @click="remove(image.id)"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </li>

      <li v-if="canAddMore">
        <button
          type="button"
          class="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-line text-grey transition-colors hover:border-orange hover:text-orange-hover"
          :disabled="uploading"
          @click="input?.click()"
        >
          <component
            :is="uploading ? Loader2 : ImagePlus"
            class="h-6 w-6"
            :class="uploading ? 'animate-spin' : ''"
            aria-hidden="true"
          />
          <span class="text-xs font-medium">{{ t('listing.publish.addPhoto') }}</span>
        </button>
      </li>
    </ul>

    <input
      ref="input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      class="sr-only"
      @change="handleFiles"
    />

    <p v-if="error" class="mt-2 text-xs font-medium text-danger" role="alert">{{ error }}</p>
    <p class="tabular mt-2 text-xs text-grey">
      {{ model.length }} / {{ LISTING_LIMITS.imagesMax }}
    </p>
  </div>
</template>
