<script setup lang="ts">
import { Search } from 'lucide-vue-next';
import { formatPrice } from '@inbox/shared';

const { t } = useI18n();

useHead({
  title: `${t('app.name')} — ${t('app.tagline')}`,
});

// Phase 1 : l'ossature seulement. Les annonces arrivent en phase 3.
const samplePrice = formatPrice(385000);
</script>

<template>
  <main id="contenu" class="shell flex-1 py-10">
    <h1 class="text-2xl font-bold tracking-tight md:text-3xl">
      {{ t('app.name') }}
    </h1>
    <p class="mt-2 text-muted">{{ t('app.tagline') }}</p>

    <div class="card-surface mt-8 flex items-center gap-3 p-4">
      <Search class="h-5 w-5 shrink-0 text-grey" aria-hidden="true" />
      <p class="text-sm text-muted">
        Ossature en place. Exemple de formatage&nbsp;:
        <span class="tabular font-semibold text-ink">{{ samplePrice }}</span>
      </p>
    </div>
  </main>
</template>
