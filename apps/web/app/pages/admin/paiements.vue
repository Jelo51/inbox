<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useFormat } from '~/composables/useFormat';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface PaymentRow {
  id: string;
  reference: string;
  amountXaf: number;
  provider: string;
  method: 'MTN_MOMO' | 'ORANGE_MONEY' | 'CARD';
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  paidAt: string | null;
  createdAt: string;
  receiptNumber: string | null;
  user: { id: string; displayName: string; email: string };
}

const { t } = useI18n();
const auth = useAuthStore();
const format = useFormat();

const items = ref<PaymentRow[]>([]);
const months = ref<{ month: string; totalXaf: number; payments: number }[]>([]);
const loading = ref(true);

useHead({ title: () => `${t('admin.payments.title')} — ${t('admin.title')}` });

onMounted(async () => {
  try {
    const [paiements, revenus] = await Promise.all([
      auth.authedRequest<{ items: PaymentRow[] }>('/admin/payments', { query: { limit: 50 } }),
      auth.authedRequest<{ months: typeof months.value }>('/admin/stats/revenue'),
    ]);
    items.value = paiements.items;
    months.value = revenus.months;
  } finally {
    loading.value = false;
  }
});

const statusTone: Record<string, string> = {
  SUCCEEDED: 'text-success',
  PENDING: 'text-pending',
  FAILED: 'text-danger',
  REFUNDED: 'text-muted',
};
</script>

<template>
  <div class="shell max-w-4xl">
    <h1 class="text-xl font-bold tracking-tight">{{ t('admin.payments.title') }}</h1>

    <p v-if="loading" class="mt-6 text-sm text-muted">{{ t('common.loading') }}</p>

    <template v-else>
      <BarList
        v-if="months.length"
        :title="t('admin.dashboard.revenueTotal')"
        :items="months.map((m) => ({ label: m.month, value: m.totalXaf }))"
        :empty-label="t('admin.dashboard.noData')"
        class="mt-5"
      />

      <p v-if="!items.length" class="mt-6 text-sm text-muted">{{ t('admin.payments.empty') }}</p>

      <ul
        v-else
        class="mt-5 divide-y divide-line overflow-hidden rounded-card border border-line bg-card"
      >
        <li v-for="payment in items" :key="payment.id" class="flex items-center gap-3 p-4">
          <div class="min-w-0 flex-1">
            <p class="tabular text-sm font-semibold">{{ format.price(payment.amountXaf) }}</p>
            <p class="mt-0.5 truncate text-xs text-grey">
              {{ payment.user.displayName }} · {{ t(`pro.methods.${payment.method}`) }} ·
              {{ format.date(payment.paidAt ?? payment.createdAt) }}
            </p>
          </div>

          <p class="tabular hidden shrink-0 text-xs text-grey sm:block">
            {{ payment.receiptNumber ?? payment.reference }}
          </p>

          <span class="shrink-0 text-xs font-semibold" :class="statusTone[payment.status]">
            {{ t(`subscription.paymentStatus.${payment.status}`) }}
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>
