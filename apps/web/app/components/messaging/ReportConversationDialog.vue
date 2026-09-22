<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';
import { useMessagingStore } from '~/stores/messaging';

/**
 * Signalement d'une conversation.
 *
 * Le serveur ne peut pas lire les messages : c'est donc l'utilisateur qui les
 * déchiffre sur son appareil et choisit de les transmettre. L'écran dit
 * exactement ce qui va être envoyé, et rien ne part sans un accord explicite.
 */
const props = defineProps<{ conversationId: string }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const auth = useAuthStore();
const messaging = useMessagingStore();

const REASONS = ['SCAM', 'HARASSMENT', 'OFFENSIVE', 'SPAM', 'PROHIBITED_ITEM', 'OTHER'] as const;

const reason = ref<(typeof REASONS)[number]>('SCAM');
const comment = ref('');
const consent = ref(false);
const submitting = ref(false);
const sent = ref(false);

const disclosed = computed(() => messaging.disclosableMessages());

async function submit() {
  if (!consent.value) return;
  submitting.value = true;
  try {
    await auth.authedRequest('/reports', {
      method: 'POST',
      body: {
        target: 'CONVERSATION',
        targetId: props.conversationId,
        reason: reason.value,
        ...(comment.value.trim() && { comment: comment.value.trim() }),
        disclosureConsent: true,
        disclosedMessages: disclosed.value,
      },
    });
    sent.value = true;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="t('messaging.reportDialog.title')"
  >
    <div
      class="max-h-full w-full max-w-lg overflow-y-auto rounded-t-card bg-card p-5 sm:rounded-card"
    >
      <h2 class="text-lg font-bold">{{ t('messaging.reportDialog.title') }}</h2>

      <template v-if="sent">
        <AppAlert tone="success" class="mt-4">{{ t('messaging.reportDialog.sent') }}</AppAlert>
        <button type="button" class="btn-primary mt-4 w-full" @click="emit('close')">
          {{ t('common.close') }}
        </button>
      </template>

      <template v-else>
        <AppAlert tone="warning" class="mt-4">
          <p>{{ t('messaging.reportDialog.explain') }}</p>
          <p class="tabular mt-2 font-semibold">
            {{ t('messaging.reportDialog.messageCount', disclosed.length) }}
          </p>
        </AppAlert>

        <form class="mt-4 flex flex-col gap-4" novalidate @submit.prevent="submit">
          <FormField id="motif" :label="t('messaging.reportDialog.reason')" required>
            <template #default="{ describedBy }">
              <select id="motif" v-model="reason" class="field" :aria-describedby="describedBy">
                <option v-for="value in REASONS" :key="value" :value="value">
                  {{ t(`messaging.reportDialog.reasons.${value}`) }}
                </option>
              </select>
            </template>
          </FormField>

          <FormField
            id="precisions"
            :label="t('messaging.reportDialog.comment')"
            :optional-label="t('common.optional')"
          >
            <template #default="{ describedBy }">
              <textarea
                id="precisions"
                v-model="comment"
                rows="3"
                maxlength="1000"
                class="field py-2"
                :aria-describedby="describedBy"
              />
            </template>
          </FormField>

          <!-- Case jamais précochée : la transmission du contenu doit être un
               acte positif de l'utilisateur. -->
          <label class="flex min-h-touch items-start gap-3 text-sm leading-relaxed">
            <input
              v-model="consent"
              type="checkbox"
              class="mt-0.5 h-5 w-5 shrink-0 rounded border-line text-orange focus:ring-orange"
              required
            />
            <span>{{ t('messaging.reportDialog.consent') }}</span>
          </label>

          <div class="flex gap-3">
            <button type="button" class="btn-secondary flex-1" @click="emit('close')">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" class="btn-primary flex-1" :disabled="!consent || submitting">
              <TriangleAlert class="h-4 w-4" aria-hidden="true" />
              {{ submitting ? t('common.loading') : t('messaging.reportDialog.submit') }}
            </button>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>
