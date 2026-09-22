<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useApiClient } from '~/composables/useApiClient';
import { useApiError } from '~/composables/useApiError';

const { t, locale } = useI18n();
const localePath = useLocalePath();
const auth = useAuthStore();
const api = useApiClient();
const apiError = useApiError();

interface LegalVersions {
  versions: Record<string, string>;
  documents: { type: string; version: string; title: string; effectiveAt: string }[];
}

/**
 * Les versions en vigueur sont lues avant l'affichage : l'utilisateur accepte
 * une version identifiée, et le serveur refuse une acceptation périmée.
 */
const { data: legal, error: legalError } = await useAsyncData('legal-versions', () =>
  api.request<LegalVersions>('/auth/legal-versions'),
);

const form = reactive({
  displayName: '',
  email: '',
  password: '',
  phone: '',
  isAdult: false,
  acceptsLegal: false,
});

const submitting = ref(false);
const error = ref<unknown>(null);

useHead({ title: () => `${t('auth.register.title')} — ${t('app.name')}` });

const canSubmit = computed(
  () => form.isAdult && form.acceptsLegal && Boolean(legal.value) && !submitting.value,
);

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'fr-FR', {
    dateStyle: 'long',
  }).format(new Date(value));
}

async function submit() {
  if (!legal.value) return;
  submitting.value = true;
  error.value = null;

  try {
    await auth.register({
      email: form.email,
      password: form.password,
      displayName: form.displayName,
      ...(form.phone.trim() && { phone: form.phone.trim() }),
      locale: locale.value,
      isAdult: true,
      acceptedLegalVersions: legal.value.versions,
    });
    await navigateTo(localePath('/verifier-email'));
  } catch (err) {
    error.value = err;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="shell max-w-md py-10">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('auth.register.title') }}</h1>
    <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('auth.register.subtitle') }}</p>

    <AppAlert v-if="legalError" tone="error" class="mt-6">
      {{ t('auth.errors.LEGAL_DOCUMENTS_UNAVAILABLE') }}
    </AppAlert>

    <AppAlert v-if="error" tone="error" class="mt-6">
      {{ apiError.message(error) }}
    </AppAlert>

    <form class="card-surface mt-6 flex flex-col gap-5 p-5" novalidate @submit.prevent="submit">
      <FormField
        id="nom"
        :label="t('auth.register.displayName')"
        :hint="t('auth.register.displayNameHint')"
        :error="apiError.fieldError(error, 'displayName')"
        required
      >
        <template #default="{ describedBy, invalid }">
          <input
            id="nom"
            v-model="form.displayName"
            type="text"
            class="field"
            :class="invalid ? 'border-danger' : ''"
            autocomplete="name"
            required
            :aria-describedby="describedBy"
          />
        </template>
      </FormField>

      <FormField
        id="email"
        :label="t('auth.register.email')"
        :error="apiError.fieldError(error, 'email')"
        required
      >
        <template #default="{ describedBy, invalid }">
          <input
            id="email"
            v-model="form.email"
            type="email"
            class="field"
            :class="invalid ? 'border-danger' : ''"
            autocomplete="email"
            inputmode="email"
            required
            :aria-describedby="describedBy"
          />
        </template>
      </FormField>

      <FormField
        id="mot-de-passe"
        :label="t('auth.register.password')"
        :hint="t('auth.register.passwordHint')"
        :error="apiError.fieldError(error, 'password')"
        required
      >
        <template #default="{ describedBy, invalid }">
          <PasswordInput
            id="mot-de-passe"
            v-model="form.password"
            autocomplete="new-password"
            :described-by="describedBy"
            :invalid="invalid"
          />
        </template>
      </FormField>

      <FormField
        id="telephone"
        :label="t('auth.register.phone')"
        :hint="t('auth.register.phoneHint')"
        :error="apiError.fieldError(error, 'phone')"
        :optional-label="t('common.optional')"
      >
        <template #default="{ describedBy, invalid }">
          <input
            id="telephone"
            v-model="form.phone"
            type="tel"
            class="field"
            :class="invalid ? 'border-danger' : ''"
            autocomplete="tel"
            inputmode="tel"
            placeholder="+237 6XX XX XX XX"
            :aria-describedby="describedBy"
          />
        </template>
      </FormField>

      <!-- Cases jamais précochées : le consentement doit être un acte positif. -->
      <label class="flex min-h-touch items-start gap-3 text-sm leading-relaxed">
        <input
          v-model="form.isAdult"
          type="checkbox"
          class="mt-0.5 h-5 w-5 shrink-0 rounded border-line text-orange focus:ring-orange"
          required
        />
        <span>{{ t('auth.register.adult') }}</span>
      </label>

      <label class="flex min-h-touch items-start gap-3 text-sm leading-relaxed">
        <input
          v-model="form.acceptsLegal"
          type="checkbox"
          class="mt-0.5 h-5 w-5 shrink-0 rounded border-line text-orange focus:ring-orange"
          required
        />
        <span>
          {{ t('auth.register.legal') }}
          <span class="mt-1 block text-xs text-grey">
            <template v-for="(doc, index) in legal?.documents ?? []" :key="doc.type">
              <NuxtLink
                :to="
                  localePath(
                    doc.type === 'CGU' ? '/legal/conditions-generales' : '/legal/confidentialite',
                  )
                "
                class="text-orange-hover hover:underline"
              >
                {{ doc.title }}
              </NuxtLink>
              <span class="tabular">
                ({{
                  t('auth.register.legalVersions', {
                    version: doc.version,
                    date: formatDate(doc.effectiveAt),
                  })
                }})
              </span>
              <span v-if="index < (legal?.documents.length ?? 0) - 1"> · </span>
            </template>
          </span>
        </span>
      </label>

      <button type="submit" class="btn-primary w-full" :disabled="!canSubmit">
        {{ submitting ? t('common.loading') : t('auth.register.submit') }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-muted">
      {{ t('auth.register.hasAccount') }}
      <NuxtLink
        :to="localePath('/connexion')"
        class="font-semibold text-orange-hover hover:underline"
      >
        {{ t('auth.register.login') }}
      </NuxtLink>
    </p>
  </div>
</template>
