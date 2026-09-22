<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useFormat } from '~/composables/useFormat';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface Stats {
  users: { total: number; verified: number; pro: number; newLast30Days: number };
  listings: { byStatus: Record<string, number>; publishedLast30Days: number };
  byCategory: { slug: string; nameFr: string; count: number }[];
  byCity: { slug: string; name: string; count: number }[];
  moderation: { pending: number; flagged: number; openReports: number };
  revenue: { last30DaysXaf: number; totalXaf: number; activeSubscriptions: number };
  registrationsByDay: { day: string; count: number }[];
}

const { t } = useI18n();
const auth = useAuthStore();
const format = useFormat();

const stats = ref<Stats | null>(null);
const loading = ref(true);

useHead({ title: () => `${t('admin.dashboard.title')} — ${t('admin.title')}` });

onMounted(async () => {
  try {
    stats.value = (await auth.authedRequest<{ stats: Stats }>('/admin/stats')).stats;
  } finally {
    loading.value = false;
  }
});

const statusLabels: Record<string, string> = {
  DRAFT: 'Brouillon',
  PENDING: 'En modération',
  PUBLISHED: 'En ligne',
  REJECTED: 'Refusée',
  EXPIRED: 'Expirée',
  SOLD: 'Vendue',
  DELETED: 'Supprimée',
};

const byStatus = computed(() =>
  Object.entries(stats.value?.listings.byStatus ?? {}).map(([status, count]) => ({
    label: statusLabels[status] ?? status,
    value: count,
  })),
);

const registrations = computed(() =>
  (stats.value?.registrationsByDay ?? []).map((row) => ({
    label: format.date(row.day),
    value: row.count,
  })),
);
</script>

<template>
  <div class="shell">
    <h1 class="text-xl font-bold tracking-tight">{{ t('admin.dashboard.title') }}</h1>

    <p v-if="loading" class="mt-6 text-sm text-muted">{{ t('common.loading') }}</p>

    <template v-else-if="stats">
      <!-- Ce qui demande une action passe en premier. -->
      <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          :label="t('admin.dashboard.pendingListings')"
          :value="stats.moderation.pending"
          :hint="`${stats.moderation.flagged} ${t('admin.dashboard.flagged')}`"
          :tone="stats.moderation.pending > 0 ? 'attention' : 'neutral'"
        />
        <StatTile
          :label="t('admin.dashboard.openReports')"
          :value="stats.moderation.openReports"
          :tone="stats.moderation.openReports > 0 ? 'attention' : 'neutral'"
        />
        <StatTile
          :label="t('admin.dashboard.members')"
          :value="format.number(stats.users.total)"
          :hint="`${format.number(stats.users.verified)} ${t('admin.dashboard.verified')}`"
        />
        <StatTile
          :label="t('admin.dashboard.proMembers')"
          :value="stats.users.pro"
          :hint="`${stats.revenue.activeSubscriptions} ${t('admin.dashboard.activeSubscriptions')}`"
          tone="success"
        />
      </div>

      <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          :label="t('admin.dashboard.newMembers')"
          :value="format.number(stats.users.newLast30Days)"
        />
        <StatTile
          :label="t('admin.dashboard.publishedListings')"
          :value="format.number(stats.listings.byStatus.PUBLISHED ?? 0)"
          :hint="`${format.number(stats.listings.publishedLast30Days)} ${t('admin.dashboard.publishedLast30')}`"
        />
        <StatTile
          :label="t('admin.dashboard.revenue30')"
          :value="format.price(stats.revenue.last30DaysXaf)"
          tone="success"
        />
        <StatTile
          :label="t('admin.dashboard.revenueTotal')"
          :value="format.price(stats.revenue.totalXaf)"
        />
      </div>

      <div class="mt-5 grid gap-3 lg:grid-cols-2">
        <BarList
          :title="t('admin.dashboard.byCategory')"
          :items="stats.byCategory.map((c) => ({ label: c.nameFr, value: c.count }))"
          :empty-label="t('admin.dashboard.noData')"
        />
        <BarList
          :title="t('admin.dashboard.byCity')"
          :items="stats.byCity.map((c) => ({ label: c.name, value: c.count }))"
          :empty-label="t('admin.dashboard.noData')"
        />
        <BarList
          :title="t('admin.dashboard.byStatus')"
          :items="byStatus"
          :empty-label="t('admin.dashboard.noData')"
        />
        <BarList
          :title="t('admin.dashboard.registrations')"
          :items="registrations"
          :empty-label="t('admin.dashboard.noData')"
        />
      </div>
    </template>
  </div>
</template>
