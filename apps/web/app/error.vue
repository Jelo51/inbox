<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();
const { t } = useI18n();

const isNotFound = computed(() => props.error?.statusCode === 404);
const key = computed(() => (isNotFound.value ? 'notFound' : 'server'));

useHead({ title: () => t(`error.${key.value}.title`) });
</script>

<template>
  <main
    id="contenu"
    class="shell flex min-h-screen flex-col items-center justify-center py-16 text-center"
  >
    <p class="tabular text-5xl font-bold text-orange">{{ error?.statusCode ?? 500 }}</p>
    <h1 class="mt-4 text-2xl font-bold">{{ t(`error.${key}.title`) }}</h1>
    <p class="mt-2 max-w-md text-muted">{{ t(`error.${key}.message`) }}</p>
    <button class="btn-primary mt-8" @click="clearError({ redirect: '/' })">
      {{ t(`error.${key}.action`) }}
    </button>
  </main>
</template>
