<script setup lang="ts">
/**
 * Liste de valeurs avec barre proportionnelle. Une barre lit mieux qu'un
 * tableau de nombres quand il s'agit de comparer des ordres de grandeur, et
 * elle ne demande aucune bibliothèque de graphiques.
 */
const props = defineProps<{
  title: string;
  items: { label: string; value: number }[];
  emptyLabel: string;
}>();

const max = computed(() => Math.max(1, ...props.items.map((item) => item.value)));
const { locale } = useI18n();

function format(value: number): string {
  return new Intl.NumberFormat(locale.value === 'en' ? 'en-GB' : 'fr-FR').format(value);
}
</script>

<template>
  <section class="card-surface p-4">
    <h2 class="text-sm font-semibold">{{ title }}</h2>

    <ul v-if="items.length" class="mt-3 space-y-2">
      <li v-for="item in items" :key="item.label" class="flex items-center gap-3">
        <span class="w-32 shrink-0 truncate text-xs text-muted">{{ item.label }}</span>
        <span class="h-2 flex-1 overflow-hidden rounded-pill bg-canvas">
          <span
            class="block h-full rounded-pill bg-orange"
            :style="{ width: `${Math.round((item.value / max) * 100)}%` }"
          />
        </span>
        <span class="tabular w-12 shrink-0 text-right text-xs font-semibold">
          {{ format(item.value) }}
        </span>
      </li>
    </ul>

    <p v-else class="mt-3 text-sm text-muted">{{ emptyLabel }}</p>
  </section>
</template>
