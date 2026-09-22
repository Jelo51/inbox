<script setup lang="ts">
import { Lock } from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';
import { useFormat } from '~/composables/useFormat';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface ReportRow {
  id: string;
  target: 'LISTING' | 'USER' | 'CONVERSATION';
  targetId: string;
  reason: string;
  comment: string | null;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  author: { id: string; displayName: string } | null;
  reportedUser: { id: string; displayName: string } | null;
  disclosedMessageCount: number;
  hasDisclosureConsent: boolean;
}

interface ReportDetail extends ReportRow {
  handlerNote: string | null;
  listing: { id: string; title: string; description: string; status: string } | null;
  disclosureConsentAt: string | null;
  disclosedMessages: {
    id: string;
    sentAt: string;
    fromReporter: boolean;
    plaintext: string;
  }[];
}

const { t } = useI18n();
const auth = useAuthStore();
const format = useFormat();

const items = ref<ReportRow[]>([]);
const selected = ref<ReportDetail | null>(null);
const statusFilter = ref<'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED' | ''>('OPEN');
const note = ref('');
const loading = ref(true);
const busy = ref(false);
const notice = ref<string | null>(null);

useHead({ title: () => `${t('admin.reports.title')} — ${t('admin.title')}` });

async function load() {
  loading.value = true;
  try {
    items.value = (
      await auth.authedRequest<{ items: ReportRow[] }>('/admin/reports', {
        query: { limit: 40, ...(statusFilter.value && { status: statusFilter.value }) },
      })
    ).items;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(statusFilter, load);

async function openReport(id: string) {
  selected.value = (
    await auth.authedRequest<{ report: ReportDetail }>(`/admin/reports/${id}`)
  ).report;
  note.value = '';
  await auth.authedRequest(`/admin/reports/${id}/claim`, { method: 'POST' });
}

async function resolve(status: 'RESOLVED' | 'DISMISSED') {
  if (!selected.value) return;
  busy.value = true;
  try {
    await auth.authedRequest(`/admin/reports/${selected.value.id}/resolve`, {
      method: 'POST',
      body: { status, ...(note.value.trim() && { note: note.value.trim() }) },
    });
    notice.value = t('admin.reports.handled');
    selected.value = null;
    await load();
  } finally {
    busy.value = false;
  }
}

const statusTone: Record<string, string> = {
  OPEN: 'bg-pending/10 text-pending',
  IN_REVIEW: 'bg-orange-soft text-orange-hover',
  RESOLVED: 'bg-success/10 text-success',
  DISMISSED: 'bg-canvas text-grey',
};
</script>

<template>
  <div class="shell max-w-5xl">
    <h1 class="text-xl font-bold tracking-tight">{{ t('admin.reports.title') }}</h1>

    <AppAlert v-if="notice" tone="success" class="mt-4">{{ notice }}</AppAlert>

    <div class="mt-4 flex items-center gap-3">
      <label for="filtre-statut" class="text-sm font-medium">{{ t('admin.reports.status') }}</label>
      <select id="filtre-statut" v-model="statusFilter" class="field max-w-xs">
        <option value="">—</option>
        <option v-for="s in ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']" :key="s" :value="s">
          {{ t(`admin.reports.statuses.${s}`) }}
        </option>
      </select>
    </div>

    <p v-if="loading" class="mt-6 text-sm text-muted">{{ t('common.loading') }}</p>

    <p v-else-if="!items.length" class="mt-6 text-sm text-muted">{{ t('admin.reports.empty') }}</p>

    <ul
      v-else
      class="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-card"
    >
      <li v-for="report in items" :key="report.id">
        <button
          type="button"
          class="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-canvas"
          @click="openReport(report.id)"
        >
          <div class="min-w-0 flex-1">
            <p class="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {{ t(`admin.reports.targets.${report.target}`) }} — {{ report.reason }}
              <span
                v-if="report.disclosedMessageCount > 0"
                class="inline-flex items-center gap-1 rounded-pill bg-orange-soft px-2 py-0.5 text-[11px] font-semibold text-orange-hover"
              >
                <Lock class="h-3 w-3" aria-hidden="true" />
                {{ report.disclosedMessageCount }}
              </span>
            </p>
            <p class="mt-0.5 truncate text-xs text-grey">
              {{ report.author?.displayName ?? '—' }} · {{ format.date(report.createdAt) }}
            </p>
          </div>

          <span
            class="shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold"
            :class="statusTone[report.status]"
          >
            {{ t(`admin.reports.statuses.${report.status}`) }}
          </span>
        </button>
      </li>
    </ul>

    <!-- Détail -->
    <div
      v-if="selected"
      class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="t('admin.reports.title')"
    >
      <div
        class="max-h-full w-full max-w-2xl overflow-y-auto rounded-t-card bg-card p-5 sm:rounded-card"
      >
        <h2 class="text-lg font-bold">
          {{ t(`admin.reports.targets.${selected.target}`) }} — {{ selected.reason }}
        </h2>
        <p class="mt-1 text-xs text-grey">
          {{ t('admin.reports.reportedBy') }} {{ selected.author?.displayName ?? '—' }} ·
          {{ format.date(selected.createdAt) }}
        </p>

        <p v-if="selected.comment" class="mt-3 rounded-card bg-canvas p-3 text-sm leading-relaxed">
          {{ selected.comment }}
        </p>

        <section v-if="selected.listing" class="mt-4 rounded-card border border-line p-3">
          <p class="text-sm font-semibold">{{ selected.listing.title }}</p>
          <p class="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted">
            {{ selected.listing.description }}
          </p>
        </section>

        <!-- Messages transmis volontairement -->
        <section v-if="selected.target === 'CONVERSATION'" class="mt-4">
          <h3 class="text-sm font-semibold">{{ t('admin.reports.disclosedMessages') }}</h3>

          <AppAlert tone="info" class="mt-2">
            {{ t('admin.reports.disclosedNotice') }}
          </AppAlert>

          <ul v-if="selected.disclosedMessages.length" class="mt-3 space-y-2">
            <li
              v-for="message in selected.disclosedMessages"
              :key="message.id"
              class="rounded-card border border-line p-3"
            >
              <p class="tabular text-[11px] font-semibold text-grey">
                {{ message.fromReporter ? 'Signalant' : 'Mis en cause' }} ·
                {{ format.date(message.sentAt) }}
              </p>
              <p class="mt-1 whitespace-pre-line text-sm leading-relaxed">
                {{ message.plaintext }}
              </p>
            </li>
          </ul>

          <p v-else class="mt-3 text-sm text-muted">{{ t('admin.reports.noDisclosure') }}</p>
        </section>

        <template v-if="selected.status === 'OPEN' || selected.status === 'IN_REVIEW'">
          <FormField id="note-traitement" :label="t('admin.reports.note')" class="mt-5">
            <template #default="{ describedBy }">
              <textarea
                id="note-traitement"
                v-model="note"
                rows="2"
                maxlength="1000"
                class="field py-2"
                :aria-describedby="describedBy"
              />
            </template>
          </FormField>

          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="btn-secondary flex-1" @click="selected = null">
              {{ t('common.close') }}
            </button>
            <button
              type="button"
              class="btn-secondary flex-1"
              :disabled="busy"
              @click="resolve('DISMISSED')"
            >
              {{ t('admin.reports.dismiss') }}
            </button>
            <button
              type="button"
              class="btn-primary flex-1"
              :disabled="busy"
              @click="resolve('RESOLVED')"
            >
              {{ t('admin.reports.resolve') }}
            </button>
          </div>
        </template>

        <button v-else type="button" class="btn-secondary mt-5 w-full" @click="selected = null">
          {{ t('common.close') }}
        </button>
      </div>
    </div>
  </div>
</template>
