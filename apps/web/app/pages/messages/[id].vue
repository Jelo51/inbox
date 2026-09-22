<script setup lang="ts">
import { ArrowLeft, Ban, Flag, Lock, Send, TriangleAlert } from 'lucide-vue-next';
import { buildListingPath } from '@inbox/shared';
import { useAuthStore } from '~/stores/auth';
import { useMessagingStore } from '~/stores/messaging';
import { useFormat } from '~/composables/useFormat';

definePageMeta({ middleware: 'auth' });

interface ConversationDetail {
  id: string;
  listing: { id: string; slug: string; title: string; price: number; priceUnit: string };
  other: {
    id: string;
    displayName: string;
    isPro: boolean;
    publicKey: string | null;
    fingerprint: string | null;
  };
  blockedByMe: boolean;
  blocked: boolean;
}

const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const auth = useAuthStore();
const messaging = useMessagingStore();
const format = useFormat();

const conversationId = computed(() => String(route.params.id));
const detail = ref<ConversationDetail | null>(null);
const draft = ref('');
const sending = ref(false);
const loading = ref(true);
const showReport = ref(false);
const showFingerprint = ref(false);
const thread = ref<HTMLElement>();

useHead({ title: () => `${t('messaging.title')} — ${t('app.name')}` });

async function load() {
  detail.value = (
    await auth.authedRequest<{ conversation: ConversationDetail }>(
      `/conversations/${conversationId.value}`,
    )
  ).conversation;
  await messaging.openConversation(conversationId.value);
  await nextTick();
  scrollToEnd();
}

function scrollToEnd() {
  if (thread.value) thread.value.scrollTop = thread.value.scrollHeight;
}

onMounted(async () => {
  try {
    await messaging.initKeys();
    if (messaging.keyState === 'pret') {
      await load();
      messaging.connectRealtime();
    }
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => messaging.disconnectRealtime());

watch(
  () => messaging.messages.length,
  () => void nextTick(scrollToEnd),
);

async function submit() {
  const text = draft.value.trim();
  if (!text || sending.value) return;

  sending.value = true;
  try {
    await messaging.send(text);
    draft.value = '';
  } finally {
    sending.value = false;
  }
}

async function toggleBlock() {
  if (!detail.value) return;
  if (detail.value.blockedByMe) {
    await auth.authedRequest(`/blocks/${detail.value.other.id}`, { method: 'DELETE' });
  } else {
    await auth.authedRequest('/blocks', {
      method: 'POST',
      body: { userId: detail.value.other.id },
    });
  }
  await load();
}
</script>

<template>
  <div class="shell max-w-3xl py-4 md:py-6">
    <p v-if="loading" class="text-sm text-muted">{{ t('common.loading') }}</p>

    <KeySetup v-else-if="messaging.keyState !== 'pret'" />

    <div v-else-if="detail" class="flex h-[calc(100dvh-10rem)] flex-col md:h-[70vh]">
      <!-- En-tête : sur mobile, le retour ramène à la liste (deux écrans). -->
      <header class="flex items-center gap-3 border-b border-line pb-3">
        <NuxtLink
          :to="localePath('/messages')"
          class="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill text-muted hover:bg-canvas md:hidden"
          :aria-label="t('messaging.backToList')"
        >
          <ArrowLeft class="h-5 w-5" aria-hidden="true" />
        </NuxtLink>

        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold">{{ detail.other.displayName }}</p>
          <NuxtLink
            :to="localePath(buildListingPath(detail.listing.slug, detail.listing.id))"
            class="truncate text-xs text-grey hover:text-orange-hover"
          >
            {{ t('messaging.aboutListing') }} {{ detail.listing.title }}
          </NuxtLink>
        </div>

        <button
          type="button"
          class="flex h-touch w-touch shrink-0 items-center justify-center rounded-pill text-grey hover:bg-canvas"
          :aria-label="t('messaging.encryption.peerFingerprint')"
          :aria-expanded="showFingerprint"
          @click="showFingerprint = !showFingerprint"
        >
          <Lock class="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <!-- Empreinte du correspondant : vérification manuelle possible. -->
      <div v-if="showFingerprint" class="mt-3 rounded-card bg-orange-soft p-3 text-xs">
        <p class="font-semibold text-ink">{{ t('messaging.encryption.peerFingerprint') }}</p>
        <p class="tabular mt-1 break-all font-medium">{{ detail.other.fingerprint ?? '—' }}</p>
        <p class="mt-2 leading-relaxed text-muted">
          {{ t('messaging.encryption.fingerprintHint') }}
        </p>
      </div>

      <AppAlert
        v-if="messaging.peerKeyChanged"
        tone="warning"
        class="mt-3"
        :title="t('messaging.encryption.keyChangedTitle')"
      >
        {{ t('messaging.encryption.keyChangedText') }}
      </AppAlert>

      <AppAlert v-if="detail.blocked" tone="error" class="mt-3">
        {{ t('messaging.blocked') }}
      </AppAlert>

      <!-- Fil -->
      <div ref="thread" class="my-3 flex-1 space-y-2 overflow-y-auto pr-1">
        <div
          v-for="message in messaging.messages"
          :key="message.id"
          class="flex"
          :class="message.fromMe ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[85%] rounded-card px-3 py-2 text-sm leading-relaxed sm:max-w-[70%]"
            :class="message.fromMe ? 'bg-orange text-white' : 'border border-line bg-card text-ink'"
          >
            <p v-if="message.text !== null" class="whitespace-pre-line break-words">
              {{ message.text }}
            </p>
            <p v-else class="flex items-center gap-1.5 italic opacity-80">
              <TriangleAlert class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {{ t('messaging.undecryptable') }}
            </p>
            <p
              class="tabular mt-1 text-[11px]"
              :class="message.fromMe ? 'text-white/70' : 'text-grey'"
            >
              {{ format.date(message.createdAt) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Saisie -->
      <form class="flex items-end gap-2 border-t border-line pt-3" @submit.prevent="submit">
        <label for="message" class="sr-only">{{ t('messaging.placeholder') }}</label>
        <textarea
          id="message"
          v-model="draft"
          rows="1"
          class="field max-h-32 flex-1 resize-none py-2"
          :placeholder="t('messaging.placeholder')"
          :disabled="detail.blocked"
          @keydown.enter.exact.prevent="submit"
        />
        <button
          type="submit"
          class="btn-primary shrink-0"
          :disabled="sending || detail.blocked || !draft.trim()"
          :aria-label="t('messaging.send')"
        >
          <Send class="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="btn-ghost text-xs" @click="toggleBlock">
          <Ban class="h-3.5 w-3.5" aria-hidden="true" />
          {{ detail.blockedByMe ? t('messaging.unblock') : t('messaging.block') }}
        </button>
        <button type="button" class="btn-ghost text-xs text-danger" @click="showReport = true">
          <Flag class="h-3.5 w-3.5" aria-hidden="true" />
          {{ t('messaging.report') }}
        </button>
      </div>
    </div>

    <ReportConversationDialog
      v-if="showReport"
      :conversation-id="conversationId"
      @close="showReport = false"
    />
  </div>
</template>
