<script setup lang="ts">
import { ImageOff } from 'lucide-vue-next';

/**
 * Photo d'annonce avec repli.
 *
 * Le repli ne sert pas qu'aux annonces sans photo : sur un hébergement sans
 * disque persistant, les fichiers de démonstration n'existent pas et le
 * navigateur afficherait une icône d'image cassée. Une tuile sobre aux
 * couleurs du produit vaut mieux qu'un rectangle vide.
 */
const props = withDefaults(
  defineProps<{
    src?: string | null;
    alt: string;
    /** Sert à choisir une teinte stable pour le repli. */
    seed?: string;
    contain?: boolean;
  }>(),
  { src: null, seed: '', contain: false },
);

const { t } = useI18n();
const failed = ref(false);

watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);

const showFallback = computed(() => !props.src || failed.value);

const TONES = [
  'bg-orange-soft text-orange',
  'bg-canvas text-muted',
  'bg-success/10 text-success',
  'bg-pending/10 text-pending',
] as const;

/** Teinte déterministe : la même annonce garde la même couleur. */
const tone = computed(() => {
  const source = props.seed || props.alt;
  let hash = 0;
  for (const char of source) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
});

const initial = computed(() => (props.alt.trim()[0] ?? '?').toUpperCase());
</script>

<template>
  <img
    v-if="!showFallback"
    :src="src!"
    :alt="alt"
    loading="lazy"
    decoding="async"
    class="h-full w-full"
    :class="contain ? 'object-contain' : 'object-cover'"
    @error="failed = true"
  />

  <div
    v-else
    class="flex h-full w-full flex-col items-center justify-center gap-2"
    :class="tone"
    role="img"
    :aria-label="alt"
  >
    <span class="text-3xl font-bold opacity-70">{{ initial }}</span>
    <span class="flex items-center gap-1 text-[11px] font-medium opacity-60">
      <ImageOff class="h-3 w-3" aria-hidden="true" />
      {{ t('listing.card.noPhoto') }}
    </span>
  </div>
</template>
