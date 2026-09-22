<script setup lang="ts">
import { useApiClient } from '~/composables/useApiClient';
import { useAuthStore } from '~/stores/auth';

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const api = useApiClient();
const auth = useAuthStore();

const state = ref<'pending' | 'success' | 'failed'>('pending');

useHead({ title: () => `${t('auth.emailChange.title')} — ${t('app.name')}` });

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : null;
  if (!token) {
    state.value = 'failed';
    return;
  }

  try {
    await api.request('/auth/email/confirm', { method: 'POST', body: { token } });
    await auth.restore();
    state.value = 'success';
  } catch {
    state.value = 'failed';
  }
});
</script>

<template>
  <div class="shell max-w-md py-10">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('auth.emailChange.title') }}</h1>

    <AppAlert v-if="state === 'pending'" tone="info" class="mt-6">
      {{ t('common.loading') }}
    </AppAlert>
    <AppAlert v-else-if="state === 'success'" tone="success" class="mt-6">
      {{ t('auth.emailChange.success') }}
    </AppAlert>
    <AppAlert v-else tone="error" class="mt-6">{{ t('auth.emailChange.failed') }}</AppAlert>

    <NuxtLink :to="localePath('/compte')" class="btn-secondary mt-6 w-full">
      {{ t('account.title') }}
    </NuxtLink>
  </div>
</template>
