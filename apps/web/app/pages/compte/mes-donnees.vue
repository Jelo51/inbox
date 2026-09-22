<script setup lang="ts">
import { Download, TriangleAlert } from 'lucide-vue-next';
import { systemClock } from '@inbox/shared';
import { useAuthStore } from '~/stores/auth';
import { ApiError } from '~/composables/useApiClient';

definePageMeta({ middleware: 'auth' });

const { t, tm, rt } = useI18n();
const localePath = useLocalePath();
const auth = useAuthStore();

useHead({ title: () => `${t('data.title')} — ${t('app.name')}` });

const rights = computed(() => (tm('data.rights') as unknown[]).map((entry) => rt(entry as string)));

// ── Export ────────────────────────────────────────────────────────────────

const exporting = ref(false);
const exportError = ref<string | null>(null);

async function downloadExport() {
  exporting.value = true;
  exportError.value = null;

  try {
    const payload = await auth.authedRequest<Record<string, unknown>>('/account/export');

    // Le fichier est fabriqué ici plutôt que suivi par un lien : la requête
    // porte le jeton d'accès dans un en-tête, qu'une navigation ne poserait pas.
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inbox-donnees-${systemClock.now().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    exportError.value = err instanceof ApiError ? err.message : t('error.server.message');
  } finally {
    exporting.value = false;
  }
}

// ── Suppression ───────────────────────────────────────────────────────────

const password = ref('');
const confirmation = ref('');
const deleting = ref(false);
const deleteError = ref<string | null>(null);

const canDelete = computed(
  () => password.value.length > 0 && confirmation.value.trim() === 'SUPPRIMER',
);

async function deleteAccount() {
  if (!canDelete.value) return;

  deleting.value = true;
  deleteError.value = null;

  try {
    await auth.authedRequest('/account/delete', {
      method: 'POST',
      body: { password: password.value, confirmation: 'SUPPRIMER' },
      csrfToken: auth.csrfToken,
    });

    auth.clearSession();
    await navigateTo(localePath('/'));
  } catch (err) {
    deleteError.value = err instanceof ApiError ? err.message : t('error.server.message');
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="shell max-w-2xl py-10">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('data.title') }}</h1>
    <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('data.intro') }}</p>

    <section class="card-surface mt-8 p-5">
      <h2 class="text-base font-semibold">{{ t('data.exportTitle') }}</h2>
      <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('data.exportBody') }}</p>

      <AppAlert v-if="exportError" tone="error" class="mt-4">{{ exportError }}</AppAlert>

      <button type="button" class="btn-primary mt-4" :disabled="exporting" @click="downloadExport">
        <Download class="size-4" aria-hidden="true" />
        {{ exporting ? t('data.exportPending') : t('data.exportAction') }}
      </button>
    </section>

    <section class="card-surface mt-6 p-5">
      <h2 class="text-base font-semibold">{{ t('data.rightsTitle') }}</h2>
      <ul class="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
        <li v-for="right in rights" :key="right">{{ right }}</li>
      </ul>
      <p class="mt-3 text-sm text-muted">
        {{ t('data.rightsMore') }}
        <NuxtLink
          :to="localePath('/legal/confidentialite')"
          class="text-orange hover:text-orange-hover"
        >
          {{ t('footer.privacy') }}
        </NuxtLink>
      </p>
    </section>

    <section class="mt-6 rounded-card border border-danger/30 bg-danger/5 p-5">
      <h2 class="flex items-center gap-2 text-base font-semibold">
        <TriangleAlert class="size-5 text-danger" aria-hidden="true" />
        {{ t('data.deleteTitle') }}
      </h2>
      <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('data.deleteBody') }}</p>
      <p class="mt-2 text-sm font-semibold">{{ t('data.deleteWarning') }}</p>

      <AppAlert v-if="deleteError" tone="error" class="mt-4">{{ deleteError }}</AppAlert>

      <form class="mt-4 space-y-4" @submit.prevent="deleteAccount">
        <FormField id="suppression-mot-de-passe" :label="t('data.deletePassword')" required>
          <template #default="{ describedBy }">
            <PasswordInput
              id="suppression-mot-de-passe"
              v-model="password"
              autocomplete="current-password"
              :described-by="describedBy"
            />
          </template>
        </FormField>

        <FormField id="suppression-confirmation" :label="t('data.deleteConfirmation')" required>
          <template #default="{ describedBy }">
            <input
              id="suppression-confirmation"
              v-model="confirmation"
              class="field"
              type="text"
              autocomplete="off"
              spellcheck="false"
              :aria-describedby="describedBy"
            />
          </template>
        </FormField>

        <button
          type="submit"
          class="btn min-h-touch w-full bg-danger px-4 text-white hover:opacity-90"
          :disabled="!canDelete || deleting"
        >
          {{ deleting ? t('data.deletePending') : t('data.deleteAction') }}
        </button>
      </form>
    </section>
  </div>
</template>
