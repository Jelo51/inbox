<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <div>
    <a href="#contenu" class="sr-only-focusable btn-primary fixed left-4 top-4 z-50">
      {{ t('nav.skipToContent') }}
    </a>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
