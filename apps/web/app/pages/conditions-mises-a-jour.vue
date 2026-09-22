<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

definePageMeta({ middleware: 'auth' });

const { t, locale } = useI18n();
const localePath = useLocalePath();
const auth = useAuthStore();

useHead({ title: () => `${t('auth.legalUpdate.title')} — ${t('app.name')}` });

const documentPath: Record<string, string> = {
  CGU: '/legal/conditions-generales',
  CONFIDENTIALITE: '/legal/confidentialite',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'fr-FR', {
    dateStyle: 'long',
  }).format(new Date(value));
}

const submitting = ref(false);

async function accept() {
  submitting.value = true;
  try {
    await auth.acceptLegal();
    await navigateTo(localePath('/compte'));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="shell max-w-xl py-10">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('auth.legalUpdate.title') }}</h1>
    <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('auth.legalUpdate.intro') }}</p>

    <ul class="mt-6 space-y-3">
      <li
        v-for="doc in auth.pendingLegal"
        :key="doc.type"
        class="card-surface flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="text-sm font-semibold">{{ doc.title }}</p>
          <p class="tabular mt-1 text-xs text-grey">
            {{
              t('auth.register.legalVersions', {
                version: doc.version,
                date: formatDate(doc.effectiveAt),
              })
            }}
          </p>
        </div>
        <NuxtLink
          :to="localePath(documentPath[doc.type] ?? '/legal/conditions-generales')"
          class="btn-secondary shrink-0"
        >
          {{ t('auth.legalUpdate.readDocument') }}
        </NuxtLink>
      </li>
    </ul>

    <button type="button" class="btn-primary mt-6 w-full" :disabled="submitting" @click="accept">
      {{ submitting ? t('common.loading') : t('auth.legalUpdate.accept') }}
    </button>
  </div>
</template>
