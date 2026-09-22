<script setup lang="ts">
import type { ListingCardItem } from './ListingCard.vue';

/**
 * Grille responsive aux paliers de la maquette :
 * 1 colonne jusqu'à 430 px, 2 jusqu'à 940 px, 3 jusqu'à 1180 px, 4 au-delà.
 */
defineProps<{ items: ListingCardItem[] }>();
</script>

<template>
  <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    <li v-for="item in items" :key="item.id">
      <ListingCard :item="item" />
    </li>
  </ul>
</template>
