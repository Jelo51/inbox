<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useApiError } from '~/composables/useApiError';

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const auth = useAuthStore();
const apiError = useApiError();

const email = ref('');
const password = ref('');
const submitting = ref(false);
const error = ref<unknown>(null);

useHead({ title: () => `${t('auth.login.title')} — ${t('app.name')}` });

async function submit() {
  submitting.value = true;
  error.value = null;
  try {
    await auth.login(email.value, password.value);
    const suite = typeof route.query.suite === 'string' ? route.query.suite : localePath('/compte');
    await navigateTo(suite);
  } catch (err) {
    error.value = err;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="shell max-w-md py-10">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('auth.login.title') }}</h1>
    <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('auth.login.subtitle') }}</p>

    <AppAlert v-if="error" tone="error" class="mt-6">
      {{ apiError.message(error) }}
    </AppAlert>

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

      <FormField id="mot-de-passe" :label="t('auth.login.password')" required>
        <template #default="{ describedBy }">
          <PasswordInput
            id="mot-de-passe"
            v-model="password"
            autocomplete="current-password"
            :described-by="describedBy"
          />
        </template>
      </FormField>

      <button type="submit" class="btn-primary w-full" :disabled="submitting">
        {{ submitting ? t('common.loading') : t('auth.login.submit') }}
      </button>

      <NuxtLink
        :to="localePath('/mot-de-passe-oublie')"
        class="text-center text-sm font-medium text-orange-hover hover:underline"
      >
        {{ t('auth.login.forgot') }}
      </NuxtLink>
    </form>

    <p class="mt-6 text-center text-sm text-muted">
      {{ t('auth.login.noAccount') }}
      <NuxtLink
        :to="localePath('/inscription')"
        class="font-semibold text-orange-hover hover:underline"
      >
        {{ t('auth.login.createAccount') }}
      </NuxtLink>
    </p>
  </div>
</template>
