<script setup lang="ts">
import { useApiClient } from '~/composables/useApiClient';
import { useAuthStore } from '~/stores/auth';

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const api = useApiClient();
const auth = useAuthStore();

type State = 'idle' | 'pending' | 'success' | 'failed';
const state = ref<State>('idle');
const resent = ref(false);

useHead({ title: () => `${t('auth.verify.title')} — ${t('app.name')}` });

/**
 * La page sert deux usages : l'arrivée depuis le lien reçu par e-mail (un
 * jeton est présent), et l'écran d'attente juste après l'inscription.
 */
onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : null;
  if (!token) return;

  state.value = 'pending';
  try {
    await api.request('/auth/verify-email', { method: 'POST', body: { token } });
    await auth.restore();
    state.value = 'success';
  } catch {
    state.value = 'failed';
  }
});

async function resend() {
  await auth.resendVerification();
  resent.value = true;
}
</script>

<template>
  <div class="shell max-w-md py-10">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('auth.verify.title') }}</h1>

    <AppAlert v-if="state === 'pending'" tone="info" class="mt-6">
      {{ t('auth.verify.pending') }}
    </AppAlert>

    <template v-else-if="state === 'success'">
      <AppAlert tone="success" class="mt-6">{{ t('auth.verify.success') }}</AppAlert>
      <NuxtLink :to="localePath('/')" class="btn-primary mt-6 w-full">
        {{ t('auth.verify.continue') }}
      </NuxtLink>
    </template>

    <template v-else-if="state === 'failed'">
      <AppAlert tone="error" class="mt-6">{{ t('auth.verify.failed') }}</AppAlert>
      <button
        v-if="auth.isAuthenticated"
        type="button"
        class="btn-primary mt-6 w-full"
        @click="resend"
      >
        {{ t('auth.verify.resend') }}
      </button>
    </template>

    <template v-else>
      <AppAlert tone="info" class="mt-6" :title="t('auth.verify.bannerTitle')">
        {{ t('auth.verify.bannerText') }}
      </AppAlert>
      <button
        v-if="auth.isAuthenticated"
        type="button"
        class="btn-secondary mt-6 w-full"
        :disabled="resent"
        @click="resend"
      >
        {{ resent ? t('auth.verify.resent') : t('auth.verify.resend') }}
      </button>
    </template>
  </div>
</template>
