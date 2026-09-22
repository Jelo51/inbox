<script setup lang="ts">
import { BadgeCheck, Check, Info, TrendingUp } from 'lucide-vue-next';
import { PAYMENT_METHODS } from '@inbox/shared';
import { useApiClient } from '~/composables/useApiClient';
import { useAuthStore } from '~/stores/auth';
import { useApiError } from '~/composables/useApiError';
import { useFormat } from '~/composables/useFormat';

const { t } = useI18n();
const localePath = useLocalePath();
const api = useApiClient();
const auth = useAuthStore();
const apiError = useApiError();
const format = useFormat();

interface Plan {
  code: string;
  nameFr: string;
  nameEn: string;
  priceXaf: number;
  priceLabel: string;
  periodDays: number;
}

const { data } = await useAsyncData('offres', () =>
  api.request<{ plans: Plan[]; demo: boolean }>('/plans'),
);

const plan = computed(() => data.value?.plans.find((p) => p.code === 'PRO_MENSUEL') ?? null);

const method = ref<(typeof PAYMENT_METHODS)[number]>('MTN_MOMO');
const payerPhone = ref('');
const submitting = ref(false);
const error = ref<unknown>(null);

useHead({
  title: () => `${t('pro.title')} — ${t('app.name')}`,
  meta: [{ name: 'description', content: t('pro.subtitle') }],
});

const needsPhone = computed(() => method.value !== 'CARD');

async function subscribe() {
  if (!auth.isAuthenticated) {
    await navigateTo({ path: localePath('/connexion'), query: { suite: localePath('/pro') } });
    return;
  }

  submitting.value = true;
  error.value = null;

  try {
    const res = await auth.authedRequest<{ redirectUrl?: string }>('/subscription', {
      method: 'POST',
      body: {
        method: method.value,
        planCode: 'PRO_MENSUEL',
        ...(needsPhone.value && { payerPhone: payerPhone.value }),
      },
    });

    if (res.redirectUrl) {
      // La redirection ne vaut pas paiement : elle mène à la page du
      // fournisseur, et c'est sa notification au serveur qui décidera.
      await navigateTo(res.redirectUrl, { external: !res.redirectUrl.startsWith('/') });
    } else {
      await navigateTo(localePath('/compte/abonnement'));
    }
  } catch (err) {
    error.value = err;
  } finally {
    submitting.value = false;
  }
}

const freeFeatures = computed(() => [
  t('pro.features.limited'),
  t('pro.features.encrypted'),
  t('pro.features.moderated'),
]);

const proFeatures = computed(() => [
  t('pro.features.unlimited'),
  t('pro.features.badge'),
  t('pro.features.ranking'),
  t('pro.features.stats'),
  t('pro.features.support'),
]);
</script>

<template>
  <div class="shell max-w-3xl py-10">
    <h1 class="text-2xl font-bold tracking-tight md:text-3xl">{{ t('pro.title') }}</h1>
    <p class="mt-2 text-muted">{{ t('pro.subtitle') }}</p>

    <AppAlert v-if="data?.demo" tone="info" class="mt-6">
      {{ t('pro.demoNotice') }}
    </AppAlert>

    <div class="mt-8 grid gap-4 md:grid-cols-2">
      <!-- Offre gratuite -->
      <section class="card-surface flex flex-col p-5">
        <h2 class="text-lg font-bold">{{ t('pro.free.name') }}</h2>
        <p class="mt-1 text-sm text-grey">{{ t('pro.free.for') }}</p>
        <p class="tabular mt-4 text-2xl font-bold">0 FCFA</p>

        <ul class="mt-5 flex-1 space-y-2.5">
          <li v-for="feature in freeFeatures" :key="feature" class="flex items-start gap-2 text-sm">
            <Check class="mt-0.5 h-4 w-4 shrink-0 text-grey" aria-hidden="true" />
            <span class="text-muted">{{ feature }}</span>
          </li>
        </ul>

        <p
          v-if="auth.isAuthenticated && auth.user?.role !== 'PRO'"
          class="mt-5 text-center text-xs font-semibold text-grey"
        >
          {{ t('pro.currentPlan') }}
        </p>
      </section>

      <!-- Offre Pro -->
      <section class="card-surface relative flex flex-col border-orange p-5">
        <p
          class="absolute -top-2.5 left-5 rounded-pill bg-orange px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white"
        >
          {{ t('pro.plan.badge') }}
        </p>

        <h2 class="flex items-center gap-2 text-lg font-bold">
          <BadgeCheck class="h-5 w-5 text-orange" aria-hidden="true" />
          {{ t('pro.plan.name') }}
        </h2>
        <p class="mt-1 text-sm text-grey">{{ t('pro.plan.for') }}</p>

        <p class="mt-4">
          <span class="tabular text-2xl font-bold text-orange">{{ plan?.priceLabel ?? '—' }}</span>
          <span class="ml-1 text-sm text-muted">{{ t('pro.perMonth') }}</span>
        </p>

        <ul class="mt-5 flex-1 space-y-2.5">
          <li v-for="feature in proFeatures" :key="feature" class="flex items-start gap-2 text-sm">
            <Check class="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <span>{{ feature }}</span>
          </li>
        </ul>

        <template v-if="auth.user?.role === 'PRO'">
          <NuxtLink :to="localePath('/compte/abonnement')" class="btn-secondary mt-6 w-full">
            {{ t('subscription.title') }}
          </NuxtLink>
        </template>

        <form v-else class="mt-6 flex flex-col gap-4" novalidate @submit.prevent="subscribe">
          <AppAlert v-if="error" tone="error">{{ apiError.message(error) }}</AppAlert>

          <FormField id="moyen" :label="t('pro.method')">
            <template #default="{ describedBy }">
              <select id="moyen" v-model="method" class="field" :aria-describedby="describedBy">
                <option v-for="value in PAYMENT_METHODS" :key="value" :value="value">
                  {{ t(`pro.methods.${value}`) }}
                </option>
              </select>
            </template>
          </FormField>

          <FormField
            v-if="needsPhone"
            id="numero-payeur"
            :label="t('pro.payerPhone')"
            :hint="t('pro.payerPhoneHint')"
            :error="apiError.fieldError(error, 'payerPhone')"
            required
          >
            <template #default="{ describedBy, invalid }">
              <input
                id="numero-payeur"
                v-model="payerPhone"
                type="tel"
                inputmode="tel"
                class="field"
                :class="invalid ? 'border-danger' : ''"
                placeholder="+237 6XX XX XX XX"
                required
                :aria-describedby="describedBy"
              />
            </template>
          </FormField>

          <button type="submit" class="btn-primary w-full" :disabled="submitting || !plan">
            {{
              submitting
                ? t('common.loading')
                : t('pro.pay', { amount: plan ? format.price(plan.priceXaf) : '' })
            }}
          </button>

          <p class="flex items-start gap-2 text-xs leading-relaxed text-grey">
            <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{{ t('pro.noAutoRenew') }} {{ t('pro.refundPolicy') }}</span>
          </p>
        </form>
      </section>
    </div>

    <section class="card-surface mt-8 flex items-start gap-3 p-5">
      <TrendingUp class="mt-0.5 h-5 w-5 shrink-0 text-orange" aria-hidden="true" />
      <p class="text-sm leading-relaxed text-muted">
        {{ t('pro.features.ranking') }} —
        <span class="text-ink">
          une annonce Pro ne passe jamais devant une annonce plus pertinente, seulement devant une
          annonce aussi pertinente.
        </span>
      </p>
    </section>
  </div>
</template>
