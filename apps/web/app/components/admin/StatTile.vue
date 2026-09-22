<script setup lang="ts">
/**
 * Tuile de chiffre. Le libellé secondaire porte la nuance (« dont repérées »,
 * « vérifiés ») : un chiffre seul se lit mal et se compare encore plus mal.
 */
defineProps<{
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'neutral' | 'attention' | 'success';
}>();

const tones = {
  neutral: 'text-ink',
  attention: 'text-pending',
  success: 'text-success',
} as const;
</script>

<template>
  <div class="card-surface p-4">
    <p class="text-xs font-semibold uppercase tracking-wide text-grey">{{ label }}</p>
    <p class="tabular mt-2 text-2xl font-bold" :class="tones[tone ?? 'neutral']">{{ value }}</p>
    <p v-if="hint" class="mt-1 text-xs text-grey">{{ hint }}</p>
  </div>
</template>
