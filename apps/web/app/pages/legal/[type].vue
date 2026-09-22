<script setup lang="ts">
const route = useRoute();
const slug = computed(() => String(route.params.type ?? ''));
</script>

<template>
  <LegalDocument :slug="slug" />
</template>
