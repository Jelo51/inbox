<script setup lang="ts">
import { useApiClient } from '~/composables/useApiClient';
import { useApiError } from '~/composables/useApiError';

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const api = useApiClient();
const apiError = useApiError();

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const password = ref('');
const confirmation = ref('');
const submitting = ref(false);
const done = ref(false);
const error = ref<unknown>(null);

useHead({ title: () => `${t('auth.reset.title')} — ${t('app.name')}` });

const mismatch = computed(
  () => confirmation.value.length > 0 && password.value !== confirmation.value,
);

async function submit() {
  if (mismatch.value) return;
  submitting.value = true;
  error.value = null;
  try {
    await api.request('/auth/password/reset', {
      method: 'POST',
      body: { token: token.value, password: password.value },
    });
    done.value = true;
  } catch (err) {
    error.value = err;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="shell max-w-md py-10">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('auth.reset.title') }}</h1>

    <template v-if="done">
      <AppAlert tone="success" class="mt-6">{{ t('auth.reset.done') }}</AppAlert>
      <NuxtLink :to="localePath('/connexion')" class="btn-primary mt-6 w-full">
        {{ t('auth.reset.loginNow') }}
      </NuxtLink>
    </template>

    <AppAlert v-else-if="!token" tone="error" class="mt-6">
      {{ t('auth.errors.INVALID_TOKEN') }}
    </AppAlert>

    <template v-else>
      <AppAlert v-if="error" tone="error" class="mt-6">{{ apiError.message(error) }}</AppAlert>

      <form class="card-surface mt-6 flex flex-col gap-5 p-5" novalidate @submit.prevent="submit">
        <FormField
          id="mot-de-passe"
          :label="t('auth.reset.password')"
          :hint="t('auth.register.passwordHint')"
          :error="apiError.fieldError(error, 'password')"
          required
        >
          <template #default="{ describedBy, invalid }">
            <PasswordInput
              id="mot-de-passe"
              v-model="password"
              autocomplete="new-password"
              :described-by="describedBy"
              :invalid="invalid"
            />
          </template>
        </FormField>

        <FormField
          id="confirmation"
          :label="t('auth.reset.confirm')"
          :error="mismatch ? t('auth.reset.mismatch') : null"
          required
        >
          <template #default="{ describedBy, invalid }">
            <PasswordInput
              id="confirmation"
              v-model="confirmation"
              autocomplete="new-password"
              :described-by="describedBy"
              :invalid="invalid"
            />
          </template>
        </FormField>

        <button type="submit" class="btn-primary w-full" :disabled="submitting || mismatch">
          {{ submitting ? t('common.loading') : t('auth.reset.submit') }}
        </button>
      </form>
    </template>
  </div>
</template>
