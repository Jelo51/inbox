<script setup lang="ts">
import { useApiClient } from '~/composables/useApiClient';
import { useApiError } from '~/composables/useApiError';

const { t } = useI18n();
const localePath = useLocalePath();
const api = useApiClient();
const apiError = useApiError();

const email = ref('');
const submitting = ref(false);
const sent = ref(false);
const error = ref<unknown>(null);

useHead({ title: () => `${t('auth.forgot.title')} — ${t('app.name')}` });

async function submit() {
  submitting.value = true;
  error.value = null;
  try {
    await api.request('/auth/password/forgot', { method: 'POST', body: { email: email.value } });
    // La réponse est la même que l'adresse existe ou non : l'écran ne doit
    // donc rien laisser deviner.
    sent.value = true;
  } catch (err) {
    error.value = err;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="shell max-w-md py-10">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('auth.forgot.title') }}</h1>

    <template v-if="sent">
      <AppAlert tone="success" class="mt-6">{{ t('auth.forgot.sent') }}</AppAlert>
      <NuxtLink :to="localePath('/connexion')" class="btn-secondary mt-6 w-full">
        {{ t('auth.forgot.backToLogin') }}
      </NuxtLink>
    </template>

    <template v-else>
      <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('auth.forgot.subtitle') }}</p>

      <AppAlert v-if="error" tone="error" class="mt-6">{{ apiError.message(error) }}</AppAlert>

      <form class="card-surface mt-6 flex flex-col gap-5 p-5" novalidate @submit.prevent="submit">
        <FormField id="email" :label="t('auth.login.email')" required>
          <template #default="{ describedBy }">
            <input
              id="email"
              v-model="email"
              type="email"
              class="field"
              autocomplete="email"
              inputmode="email"
              required
              :aria-describedby="describedBy"
            />
          </template>
        </FormField>

        <button type="submit" class="btn-primary w-full" :disabled="submitting">
          {{ submitting ? t('common.loading') : t('auth.forgot.submit') }}
        </button>
      </form>
    </template>
  </div>
</template>
