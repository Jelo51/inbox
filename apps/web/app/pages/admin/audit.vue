<script setup lang="ts">
import { Lock } from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';
import { useFormat } from '~/composables/useFormat';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface AuditRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; displayName: string; role: string } | null;
}

const { t, te } = useI18n();
const auth = useAuthStore();
const format = useFormat();

const items = ref<AuditRow[]>([]);
const cursor = ref<string | null>(null);
const loading = ref(true);
const loadingMore = ref(false);

useHead({ title: () => `${t('admin.audit.title')} — ${t('admin.title')}` });

async function load(next = false) {
  if (next) loadingMore.value = true;
  try {
    const res = await auth.authedRequest<{ items: AuditRow[]; nextCursor: string | null }>(
      '/admin/audit',
      { query: { limit: 40, ...(next && cursor.value ? { cursor: cursor.value } : {}) } },
    );
    items.value = next ? [...items.value, ...res.items] : res.items;
    cursor.value = res.nextCursor;
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

onMounted(() => load());

/** Une action inconnue s'affiche telle quelle plutôt que de casser la page. */
function actionLabel(action: string): string {
  const key = `admin.audit.actions.${action}`;
  return te(key) ? t(key) : action;
}
</script>

<template>
  <div class="shell max-w-4xl">
    <h1 class="text-xl font-bold tracking-tight">{{ t('admin.audit.title') }}</h1>

    <AppAlert tone="info" class="mt-4">
      <p class="flex items-start gap-2">
        <Lock class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{{ t('admin.audit.notice') }}</span>
      </p>
    </AppAlert>

    <p v-if="loading" class="mt-6 text-sm text-muted">{{ t('common.loading') }}</p>

    <p v-else-if="!items.length" class="mt-6 text-sm text-muted">{{ t('admin.audit.empty') }}</p>

    <template v-else>
      <ul class="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
        <li v-for="entry in items" :key="entry.id" class="p-4">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <p class="text-sm font-semibold">{{ actionLabel(entry.action) }}</p>
            <p class="tabular text-xs text-grey">{{ format.date(entry.createdAt) }}</p>
          </div>

          <p class="mt-1 text-xs text-muted">
            {{ t('admin.audit.actor') }} :
            <span :class="entry.actor ? 'font-medium text-ink' : 'italic'">
              {{ entry.actor?.displayName ?? t('admin.audit.deletedActor') }}
            </span>
            · {{ t('admin.audit.target') }} :
            <span class="tabular">{{ entry.targetType }} {{ entry.targetId.slice(-8) }}</span>
          </p>

          <p v-if="entry.reason" class="mt-1 text-xs text-muted">
            {{ t('admin.audit.reason') }} : {{ entry.reason }}
          </p>

          <pre
            v-if="entry.metadata"
            class="mt-2 overflow-x-auto rounded bg-canvas p-2 text-[11px] leading-relaxed text-muted"
            >{{ JSON.stringify(entry.metadata, null, 2) }}</pre>
        </li>
      </ul>

      <div v-if="cursor" class="mt-4 flex justify-center">
        <button type="button" class="btn-secondary" :disabled="loadingMore" @click="load(true)">
          {{ loadingMore ? t('common.loading') : t('admin.loadMore') }}
        </button>
      </div>
    </template>
  </div>
</template>
