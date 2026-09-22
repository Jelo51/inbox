<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a href="#contenu" class="sr-only-focusable btn-primary fixed left-4 top-4 z-50">
      {{ t('nav.skipToContent') }}
    </a>
    <NuxtPage />
  </div>
</template>
