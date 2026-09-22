<script setup lang="ts">
import { CircleCheck, TriangleAlert } from 'lucide-vue-next';
import { REJECTION_REASONS } from '@inbox/shared';
import { useAuthStore } from '~/stores/auth';
import { useFormat } from '~/composables/useFormat';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface QueueItem {
  id: string;
  title: string;
  description: string;
  price: number;
  priceUnit: string;
  condition: string;
  neighbourhood: string | null;
  createdAt: string;
  cityName: string;
  categoryNameFr: string;
  images: { id: string; publicId: string }[];
  seller: {
    id: string;
    displayName: string;
    email: string;
    isPro: boolean;
    status: string;
    memberSince: string;
    listingCount: number;
    reportCount: number;
  };
  flags: { rule: string; matchedOn: string; severity: number }[];
  riskScore: number;
}

const { t } = useI18n();
const auth = useAuthStore();
const format = useFormat();
const config = useRuntimeConfig();

const items = ref<QueueItem[]>([]);
const loading = ref(true);
const notice = ref<string | null>(null);
const rejecting = ref<string | null>(null);
const rejectReason = ref<(typeof REJECTION_REASONS)[number]>('OTHER');
const rejectNote = ref('');
const busy = ref(false);

useHead({ title: () => `${t('admin.moderation.title')} — ${t('admin.title')}` });

async function load() {
  loading.value = true;
  try {
    items.value = (
      await auth.authedRequest<{ items: QueueItem[] }>('/admin/moderation/queue', {
        query: { limit: 30 },
      })
    ).items;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function imageUrl(publicId: string): string {
  const base = config.public.apiBase.replace(/\/api\/v1$/, '');
  return `${base}/media/${publicId}.webp`;
}

async function approve(id: string) {
  busy.value = true;
  try {
    await auth.authedRequest(`/admin/moderation/listings/${id}`, {
      method: 'POST',
      body: { decision: 'APPROVE' },
    });
    notice.value = t('admin.moderation.approved');
    await load();
  } finally {
    busy.value = false;
  }
}

async function reject(id: string) {
  busy.value = true;
  try {
    await auth.authedRequest(`/admin/moderation/listings/${id}`, {
      method: 'POST',
      body: {
        decision: 'REJECT',
        reason: rejectReason.value,
        ...(rejectNote.value.trim() && { note: rejectNote.value.trim() }),
      },
    });
    notice.value = t('admin.moderation.rejected');
    rejecting.value = null;
    rejectNote.value = '';
    await load();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="shell max-w-4xl">
    <h1 class="text-xl font-bold tracking-tight">{{ t('admin.moderation.title') }}</h1>

    <AppAlert v-if="notice" tone="success" class="mt-4">{{ notice }}</AppAlert>

    <p v-if="loading" class="mt-6 text-sm text-muted">{{ t('common.loading') }}</p>

    <div v-else-if="!items.length" class="card-surface mt-6 p-8 text-center">
      <CircleCheck class="mx-auto h-8 w-8 text-success" aria-hidden="true" />
      <p class="mt-3 text-sm font-medium">{{ t('admin.moderation.empty') }}</p>
      <p class="mt-1 text-xs text-grey">{{ t('admin.moderation.emptyHint') }}</p>
    </div>

    <ul v-else class="mt-5 space-y-4">
      <li v-for="item in items" :key="item.id" class="card-surface overflow-hidden">
        <!-- Ce que le filtre a repéré, en tête et sans ambiguïté sur son rôle. -->
        <div v-if="item.flags.length" class="border-b border-pending/30 bg-pending/5 p-3">
          <p class="flex items-center gap-2 text-sm font-semibold text-pending">
            <TriangleAlert class="h-4 w-4" aria-hidden="true" />
            {{ t('admin.moderation.riskFlagged') }}
          </p>
          <ul class="mt-2 space-y-1">
            <li v-for="flag in item.flags" :key="flag.rule" class="text-xs text-muted">
              <span class="font-medium text-ink">{{ flag.rule }}</span>
              — « {{ flag.matchedOn }} »
            </li>
          </ul>
          <p class="mt-2 text-xs italic text-grey">{{ t('admin.moderation.riskHint') }}</p>
        </div>

        <div class="p-4">
          <div class="flex gap-4">
            <div
              class="h-24 w-24 shrink-0 overflow-hidden rounded-card border border-line bg-canvas"
            >
              <ListingPhoto
                v-if="item.images[0]"
                :src="imageUrl(item.images[0].publicId)"
                :alt="item.title"
                :seed="item.id"
              />
            </div>

            <div class="min-w-0 flex-1">
              <h2 class="font-semibold leading-snug">{{ item.title }}</h2>
              <p class="tabular mt-1 text-sm font-bold text-ink">
                {{ format.price(item.price) }}
              </p>
              <p class="mt-1 text-xs text-grey">
                {{ item.categoryNameFr }} · {{ item.cityName }}
                <template v-if="item.neighbourhood">, {{ item.neighbourhood }}</template>
                · {{ format.date(item.createdAt) }}
              </p>
            </div>
          </div>

          <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
            {{ item.description }}
          </p>

          <!-- Contexte du vendeur : un compte neuf et déjà signalé n'appelle pas
               la même décision qu'un vendeur installé. -->
          <div class="mt-4 rounded-card bg-canvas p-3 text-xs">
            <p class="font-semibold text-ink">
              {{ t('admin.moderation.seller') }} : {{ item.seller.displayName }}
              <span v-if="item.seller.isPro" class="ml-1 text-orange">Pro</span>
            </p>
            <p class="mt-1 text-muted">
              {{
                t('admin.moderation.memberSince', { date: format.date(item.seller.memberSince) })
              }}
              · {{ t('admin.moderation.listingCount', item.seller.listingCount) }}
              <template v-if="item.seller.reportCount > 0">
                ·
                <span class="font-medium text-danger">
                  {{ t('admin.moderation.reportCount', item.seller.reportCount) }}
                </span>
              </template>
            </p>
          </div>

          <div v-if="rejecting !== item.id" class="mt-4 flex flex-wrap gap-2">
            <button type="button" class="btn-primary" :disabled="busy" @click="approve(item.id)">
              {{ t('admin.moderation.approve') }}
            </button>
            <button
              type="button"
              class="btn-secondary text-danger"
              :disabled="busy"
              @click="((rejecting = item.id), (rejectReason = 'OTHER'))"
            >
              {{ t('admin.moderation.reject') }}
            </button>
          </div>

          <!-- Le motif est obligatoire : l'auteur le reçoit par e-mail. -->
          <form
            v-else
            class="mt-4 flex flex-col gap-3 rounded-card border border-danger/30 bg-danger/5 p-3"
            @submit.prevent="reject(item.id)"
          >
            <p class="text-sm font-semibold">{{ t('admin.moderation.rejectTitle') }}</p>

            <FormField
              :id="`motif-${item.id}`"
              :label="t('admin.moderation.rejectReason')"
              required
            >
              <template #default="{ describedBy }">
                <select
                  :id="`motif-${item.id}`"
                  v-model="rejectReason"
                  class="field"
                  :aria-describedby="describedBy"
                >
                  <option v-for="reason in REJECTION_REASONS" :key="reason" :value="reason">
                    {{ t(`admin.moderation.reasons.${reason}`) }}
                  </option>
                </select>
              </template>
            </FormField>

            <FormField
              :id="`note-${item.id}`"
              :label="t('admin.moderation.rejectNote')"
              :hint="t('admin.moderation.rejectNoteHint')"
              :optional-label="t('common.optional')"
            >
              <template #default="{ describedBy }">
                <textarea
                  :id="`note-${item.id}`"
                  v-model="rejectNote"
                  rows="2"
                  maxlength="500"
                  class="field py-2"
                  :aria-describedby="describedBy"
                />
              </template>
            </FormField>

            <div class="flex gap-2">
              <button type="button" class="btn-secondary flex-1" @click="rejecting = null">
                {{ t('common.cancel') }}
              </button>
              <button type="submit" class="btn-primary flex-1" :disabled="busy">
                {{ t('admin.moderation.confirmReject') }}
              </button>
            </div>
          </form>
        </div>
      </li>
    </ul>
  </div>
</template>
