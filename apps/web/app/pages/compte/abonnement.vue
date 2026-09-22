<script setup lang="ts">
import { Download, FileText } from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';
import { useFormat } from '~/composables/useFormat';

definePageMeta({ middleware: 'auth' });

interface Subscription {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAYMENT_FAILED';
  planName: string;
  priceXaf: number;
  startedAt: string | null;
  endsAt: string | null;
  cancelledAt: string | null;
}

interface PaymentRow {
  id: string;
  reference: string;
  amountLabel: string;
  method: 'MTN_MOMO' | 'ORANGE_MONEY' | 'CARD';
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  paidAt: string | null;
  createdAt: string;
  receiptNumber: string | null;
}

const { t } = useI18n();
const localePath = useLocalePath();
const auth = useAuthStore();
const format = useFormat();
const config = useRuntimeConfig();

const subscription = ref<Subscription | null>(null);
const payments = ref<PaymentRow[]>([]);
const loading = ref(true);
const cancelling = ref(false);

useHead({ title: () => `${t('subscription.title')} — ${t('app.name')}` });

async function load() {
  const [sub, history] = await Promise.all([
    auth.authedRequest<{ subscription: Subscription | null }>('/subscription'),
    auth.authedRequest<{ items: PaymentRow[] }>('/payments'),
  ]);
  subscription.value = sub.subscription;
  payments.value = history.items;
}

onMounted(async () => {
  try {
    await load();
  } finally {
    loading.value = false;
  }
});

const statusTone: Record<string, string> = {
  ACTIVE: 'bg-success/10 text-success',
  PENDING: 'bg-pending/10 text-pending',
  PAYMENT_FAILED: 'bg-danger/10 text-danger',
  CANCELLED: 'bg-canvas text-muted',
  EXPIRED: 'bg-canvas text-grey',
};

async function cancel() {
  if (!globalThis.confirm(t('subscription.cancelConfirm'))) return;
  cancelling.value = true;
  try {
    await auth.authedRequest('/subscription', { method: 'DELETE', body: {} });
    await load();
  } finally {
    cancelling.value = false;
  }
}

/**
 * Le reçu est servi par l'API avec le jeton d'accès : un lien direct ne
 * fonctionnerait pas, le navigateur n'ajoutant pas l'en-tête d'autorisation.
 */
async function downloadReceipt(payment: PaymentRow) {
  const response = await fetch(`${config.public.apiBase}/payments/${payment.id}/receipt`, {
    headers: { Authorization: `Bearer ${auth.accessToken ?? ''}` },
    credentials: 'include',
  });
  if (!response.ok) return;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `recu-${payment.receiptNumber ?? payment.reference}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="shell max-w-2xl py-8">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('subscription.title') }}</h1>

    <p v-if="loading" class="mt-6 text-sm text-muted">{{ t('common.loading') }}</p>

    <template v-else>
      <section v-if="subscription" class="card-surface mt-6 p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold">{{ subscription.planName }}</h2>
            <p class="tabular mt-1 text-sm text-muted">{{ format.price(subscription.priceXaf) }}</p>
          </div>
          <span
            class="rounded-pill px-2.5 py-1 text-xs font-semibold"
            :class="statusTone[subscription.status] ?? 'bg-canvas text-grey'"
          >
            {{ t(`subscription.status.${subscription.status}`) }}
          </span>
        </div>

        <p v-if="subscription.cancelledAt && subscription.endsAt" class="mt-4 text-sm text-muted">
          {{ t('subscription.cancelled', { date: format.date(subscription.cancelledAt) }) }}
          <br />
          {{ t('subscription.endsOn', { date: format.date(subscription.endsAt) }) }}
        </p>
        <p v-else-if="subscription.endsAt" class="mt-4 text-sm text-muted">
          {{ t('subscription.activeUntil', { date: format.date(subscription.endsAt) }) }}
        </p>

        <div class="mt-5 flex flex-wrap gap-3">
          <button
            v-if="subscription.status === 'ACTIVE' && !subscription.cancelledAt"
            type="button"
            class="btn-secondary"
            :disabled="cancelling"
            @click="cancel"
          >
            {{ t('subscription.cancel') }}
          </button>
          <NuxtLink
            v-if="subscription.status !== 'ACTIVE'"
            :to="localePath('/pro')"
            class="btn-primary"
          >
            {{ t('subscription.renew') }}
          </NuxtLink>
        </div>
      </section>

      <section v-else class="card-surface mt-6 p-8 text-center">
        <p class="text-sm text-muted">{{ t('subscription.none') }}</p>
        <NuxtLink :to="localePath('/pro')" class="btn-primary mt-4">
          {{ t('subscription.discover') }}
        </NuxtLink>
      </section>

      <section class="mt-8">
        <h2 class="text-base font-bold">{{ t('subscription.payments') }}</h2>

        <ul
          v-if="payments.length"
          class="mt-3 divide-y divide-line rounded-card border border-line bg-card"
        >
          <li v-for="payment in payments" :key="payment.id" class="flex items-center gap-3 p-4">
            <FileText class="h-5 w-5 shrink-0 text-grey" aria-hidden="true" />

            <div class="min-w-0 flex-1">
              <p class="tabular text-sm font-semibold">{{ payment.amountLabel }}</p>
              <p class="tabular mt-0.5 truncate text-xs text-grey">
                {{ payment.receiptNumber ?? payment.reference }} ·
                {{ t(`pro.methods.${payment.method}`) }} ·
                {{ format.date(payment.paidAt ?? payment.createdAt) }}
              </p>
            </div>

            <span
              class="shrink-0 text-xs font-semibold"
              :class="payment.status === 'SUCCEEDED' ? 'text-success' : 'text-grey'"
            >
              {{ t(`subscription.paymentStatus.${payment.status}`) }}
            </span>

            <button
              v-if="payment.receiptNumber"
              type="button"
              class="btn-ghost shrink-0 text-xs"
              :aria-label="`${t('subscription.download')} ${payment.receiptNumber}`"
              @click="downloadReceipt(payment)"
            >
              <Download class="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        </ul>

        <p v-else class="mt-3 text-sm text-muted">{{ t('subscription.noPayments') }}</p>
      </section>
    </template>
  </div>
</template>
