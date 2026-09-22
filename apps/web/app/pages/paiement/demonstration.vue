<script setup lang="ts">
import { CircleCheck, CircleX, Info, Smartphone } from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';

definePageMeta({ middleware: 'auth' });

/**
 * Espace de paiement de démonstration.
 *
 * Il remplace la page du fournisseur tant qu'aucun compte Maviance ni Stripe
 * n'est ouvert. La confirmation part vers le serveur et emprunte exactement le
 * même chemin qu'une notification réelle : c'est lui qui active l'abonnement,
 * jamais cette page. L'API refuse cette route en production.
 */
const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const auth = useAuthStore();

const reference = computed(() =>
  typeof route.query.reference === 'string' ? route.query.reference : '',
);

interface PaymentRow {
  reference: string;
  amountLabel: string;
  status: string;
}

const payment = ref<PaymentRow | null>(null);
const state = ref<'idle' | 'pending' | 'success' | 'failed'>('idle');

useHead({
  title: () => `${t('demoPayment.title')} — ${t('app.name')}`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
});

onMounted(async () => {
  const { items } = await auth.authedRequest<{ items: PaymentRow[] }>('/payments');
  payment.value = items.find((item) => item.reference === reference.value) ?? null;
});

async function decide(outcome: 'SUCCEEDED' | 'FAILED') {
  state.value = 'pending';
  try {
    await auth.authedRequest('/billing/demo/confirm', {
      method: 'POST',
      body: { reference: reference.value, outcome },
    });
    // Le rôle Pro vient du serveur : on recharge la session plutôt que de
    // supposer le résultat côté navigateur.
    await auth.restore();
    state.value = outcome === 'SUCCEEDED' ? 'success' : 'failed';
  } catch {
    state.value = 'failed';
  }
}
</script>

<template>
  <div class="shell max-w-md py-10">
    <h1 class="text-xl font-bold tracking-tight">{{ t('demoPayment.title') }}</h1>

    <AppAlert tone="info" class="mt-4">
      <p>{{ t('demoPayment.notice') }}</p>
      <p class="mt-2 flex items-start gap-2">
        <Info class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{{ t('demoPayment.howItWorks') }}</span>
      </p>
    </AppAlert>

    <template v-if="state === 'success'">
      <div class="card-surface mt-6 flex flex-col items-center p-8 text-center">
        <CircleCheck class="h-12 w-12 text-success" aria-hidden="true" />
        <p class="mt-4 text-sm leading-relaxed">{{ t('demoPayment.success') }}</p>
        <NuxtLink :to="localePath('/compte/abonnement')" class="btn-primary mt-6">
          {{ t('demoPayment.back') }}
        </NuxtLink>
      </div>
    </template>

    <template v-else-if="state === 'failed'">
      <div class="card-surface mt-6 flex flex-col items-center p-8 text-center">
        <CircleX class="h-12 w-12 text-danger" aria-hidden="true" />
        <p class="mt-4 text-sm leading-relaxed">{{ t('demoPayment.failed') }}</p>
        <NuxtLink :to="localePath('/pro')" class="btn-secondary mt-6">
          {{ t('demoPayment.back') }}
        </NuxtLink>
      </div>
    </template>

    <template v-else>
      <div class="card-surface mt-6 p-5">
        <p class="flex items-center gap-2 text-sm font-semibold">
          <Smartphone class="h-5 w-5 text-orange" aria-hidden="true" />
          {{ payment?.amountLabel ?? '—' }}
        </p>

        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-grey">{{ t('demoPayment.reference') }}</dt>
            <dd class="tabular truncate">{{ reference }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-grey">{{ t('demoPayment.amount') }}</dt>
            <dd class="tabular font-semibold">{{ payment?.amountLabel ?? '—' }}</dd>
          </div>
        </dl>

        <div class="mt-6 flex flex-col gap-3">
          <button
            type="button"
            class="btn-primary w-full"
            :disabled="state === 'pending' || !reference"
            @click="decide('SUCCEEDED')"
          >
            {{ state === 'pending' ? t('demoPayment.confirming') : t('demoPayment.confirm') }}
          </button>
          <button
            type="button"
            class="btn-secondary w-full"
            :disabled="state === 'pending' || !reference"
            @click="decide('FAILED')"
          >
            {{ t('demoPayment.decline') }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
