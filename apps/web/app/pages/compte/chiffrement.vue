<script setup lang="ts">
import { useMessagingStore } from '~/stores/messaging';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const messaging = useMessagingStore();
const loading = ref(true);

useHead({ title: () => `${t('messaging.encryption.title')} — ${t('app.name')}` });

onMounted(async () => {
  try {
    await messaging.initKeys();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="shell max-w-lg py-8">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('messaging.encryption.title') }}</h1>

    <p v-if="loading" class="mt-6 text-sm text-muted">{{ t('common.loading') }}</p>

    <template v-else-if="messaging.keyState === 'pret'">
      <KeyBackupForm class="mt-6" />
    </template>

    <KeySetup v-else class="mt-6" />
  </div>
</template>
