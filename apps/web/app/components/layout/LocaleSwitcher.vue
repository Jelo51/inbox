<script setup lang="ts">
import { Languages } from 'lucide-vue-next';

/**
 * Le choix de langue est mémorisé dans un cookie strictement nécessaire : il
 * enregistre une préférence explicite, et ne sert à rien d'autre.
 */
const { locale, locales, setLocale } = useI18n();

const options = computed(() =>
  (locales.value as { code: string; name: string }[]).map((l) => ({
    code: l.code,
    name: l.name,
  })),
);
</script>

<template>
  <div class="flex items-center gap-2">
    <Languages class="h-4 w-4 text-grey" aria-hidden="true" />
    <span id="choix-langue" class="sr-only">Langue</span>
    <div class="flex gap-1" role="group" aria-labelledby="choix-langue">
      <button
        v-for="option in options"
        :key="option.code"
        type="button"
        class="rounded-pill px-2.5 py-1 text-xs font-semibold transition-colors"
        :class="
          locale === option.code ? 'bg-orange-soft text-orange-hover' : 'text-grey hover:text-ink'
        "
        :aria-current="locale === option.code ? 'true' : undefined"
        @click="setLocale(option.code as 'fr' | 'en')"
      >
        {{ option.name }}
      </button>
    </div>
  </div>
</template>
