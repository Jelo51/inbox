<script setup lang="ts">
import { systemClock } from '@inbox/shared';
import { useAuthStore } from '~/stores/auth';
import { useFormat } from '~/composables/useFormat';
import { ApiError } from '~/composables/useApiClient';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const { t } = useI18n();
const auth = useAuthStore();
const format = useFormat();

useHead({ title: () => `${t('admin.legal.title')} — ${t('admin.title')}` });

interface DocumentRow {
  id: string;
  type: string;
  locale: string;
  version: string;
  title: string;
  effectiveAt: string;
  publishedAt: string | null;
  requiresAcceptance: boolean;
  acceptances: number;
}

const documents = ref<DocumentRow[]>([]);
const loading = ref(true);

async function load() {
  documents.value = (
    await auth.authedRequest<{ documents: DocumentRow[] }>('/admin/legal')
  ).documents;
}

onMounted(async () => {
  try {
    await load();
  } finally {
    loading.value = false;
  }
});

// ── Publication d'une nouvelle version ────────────────────────────────────

const form = reactive({
  type: 'CGU',
  locale: 'fr',
  version: '',
  title: '',
  body: '',
  effectiveAt: systemClock.now().toISOString().slice(0, 10),
});

const publishing = ref(false);
const error = ref<string | null>(null);
const success = ref(false);

/**
 * Reprendre le texte d'une version existante : la plupart des nouvelles
 * versions sont des retouches, et recopier sept mille signes à la main est le
 * meilleur moyen d'en perdre un morceau.
 */
async function reuse(row: DocumentRow) {
  const { document } = await auth.authedRequest<{ document: { body: string } }>(
    `/admin/legal/${row.id}`,
  );
  form.type = row.type;
  form.locale = row.locale;
  form.title = row.title;
  form.body = document.body;
  form.version = '';
  success.value = false;
}

async function publish() {
  publishing.value = true;
  error.value = null;
  success.value = false;

  try {
    await auth.authedRequest('/admin/legal', {
      method: 'POST',
      body: { ...form, effectiveAt: new Date(form.effectiveAt).toISOString() },
      csrfToken: auth.csrfToken,
    });
    success.value = true;
    form.body = '';
    form.version = '';
    await load();
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : t('error.server.message');
  } finally {
    publishing.value = false;
  }
}

const TYPES = [
  'MENTIONS_LEGALES',
  'CGU',
  'CGV',
  'CONFIDENTIALITE',
  'COOKIES',
  'REGLES_PUBLICATION',
  'CONSEILS_SECURITE',
];
</script>

<template>
  <div class="shell">
    <h1 class="text-xl font-bold tracking-tight">{{ t('admin.legal.title') }}</h1>
    <p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{{ t('admin.legal.intro') }}</p>

    <p v-if="loading" class="mt-6 text-sm text-muted">{{ t('common.loading') }}</p>

    <div v-else class="card-surface mt-6 overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-line text-left text-xs uppercase tracking-wide text-grey">
            <th scope="col" class="px-4 py-3">{{ t('admin.legal.type') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('admin.legal.locale') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('admin.legal.version') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('admin.legal.effectiveAt') }}</th>
            <th scope="col" class="px-4 py-3">{{ t('admin.legal.acceptances') }}</th>
            <th scope="col" class="px-4 py-3"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in documents" :key="row.id" class="border-b border-line last:border-0">
            <td class="px-4 py-3">
              {{ row.title }}
              <span v-if="row.requiresAcceptance" class="ml-2 text-xs text-pending">
                {{ t('admin.legal.requiresAcceptance') }}
              </span>
            </td>
            <td class="px-4 py-3 uppercase">{{ row.locale }}</td>
            <td class="tabular px-4 py-3">
              {{ row.version }}
              <span v-if="!row.publishedAt" class="ml-1 text-xs text-grey">
                ({{ t('admin.legal.draft') }})
              </span>
            </td>
            <td class="tabular px-4 py-3">{{ format.date(row.effectiveAt) }}</td>
            <td class="tabular px-4 py-3">{{ row.acceptances }}</td>
            <td class="px-4 py-3 text-right">
              <button type="button" class="btn-ghost" @click="reuse(row)">
                {{ t('admin.legal.load') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <section class="card-surface mt-8 p-5">
      <h2 class="text-base font-semibold">{{ t('admin.legal.newVersion') }}</h2>

      <AppAlert v-if="error" tone="error" class="mt-4">{{ error }}</AppAlert>
      <AppAlert v-if="success" tone="success" class="mt-4">
        {{ t('admin.legal.published') }}
      </AppAlert>

      <form class="mt-4 space-y-4" @submit.prevent="publish">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField id="legal-type" :label="t('admin.legal.type')" required>
            <template #default="{ describedBy }">
              <select
                id="legal-type"
                v-model="form.type"
                class="field"
                :aria-describedby="describedBy"
              >
                <option v-for="type in TYPES" :key="type" :value="type">{{ type }}</option>
              </select>
            </template>
          </FormField>

          <FormField id="legal-locale" :label="t('admin.legal.locale')" required>
            <template #default="{ describedBy }">
              <select
                id="legal-locale"
                v-model="form.locale"
                class="field"
                :aria-describedby="describedBy"
              >
                <option value="fr">fr</option>
                <option value="en">en</option>
              </select>
            </template>
          </FormField>

          <FormField id="legal-version" :label="t('admin.legal.version')" required>
            <template #default="{ describedBy }">
              <input
                id="legal-version"
                v-model="form.version"
                class="field"
                type="text"
                placeholder="1.1"
                :aria-describedby="describedBy"
              />
            </template>
          </FormField>

          <FormField id="legal-effective" :label="t('admin.legal.effectiveAt')" required>
            <template #default="{ describedBy }">
              <input
                id="legal-effective"
                v-model="form.effectiveAt"
                class="field"
                type="date"
                :aria-describedby="describedBy"
              />
            </template>
          </FormField>
        </div>

        <FormField id="legal-title" :label="t('admin.legal.titleField')" required>
          <template #default="{ describedBy }">
            <input
              id="legal-title"
              v-model="form.title"
              class="field"
              type="text"
              :aria-describedby="describedBy"
            />
          </template>
        </FormField>

        <FormField
          id="legal-body"
          :label="t('admin.legal.body')"
          :hint="t('admin.legal.bodyHint')"
          required
        >
          <template #default="{ describedBy }">
            <textarea
              id="legal-body"
              v-model="form.body"
              class="field min-h-[22rem] py-2 font-mono text-xs leading-relaxed"
              :aria-describedby="describedBy"
            />
          </template>
        </FormField>

        <button type="submit" class="btn-primary" :disabled="publishing">
          {{ publishing ? t('admin.legal.publishing') : t('admin.legal.publish') }}
        </button>
      </form>
    </section>
  </div>
</template>
