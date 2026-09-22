<script setup lang="ts">
import { MessageSquare } from 'lucide-vue-next';
import { useMessagingStore } from '~/stores/messaging';
import { useFormat } from '~/composables/useFormat';

definePageMeta({ middleware: 'auth' });

const { t } = useI18n();
const localePath = useLocalePath();
const messaging = useMessagingStore();
const format = useFormat();

const loading = ref(true);

useHead({ title: () => `${t('messaging.title')} — ${t('app.name')}` });

onMounted(async () => {
  try {
    await messaging.initKeys();
    if (messaging.keyState === 'pret') {
      await messaging.loadConversations();
      messaging.connectRealtime();
    }
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => messaging.disconnectRealtime());
</script>

<template>
  <div class="shell max-w-3xl py-6">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('messaging.title') }}</h1>

    <p v-if="loading" class="mt-6 text-sm text-muted">{{ t('common.loading') }}</p>

    <!-- Tant que le chiffrement n'est pas prêt, rien d'autre n'a de sens. -->
    <KeySetup v-else-if="messaging.keyState !== 'pret'" class="mt-6" />

    <template v-else-if="messaging.conversations.length">
      <ul class="mt-6 divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
        <li v-for="conversation in messaging.conversations" :key="conversation.id">
          <NuxtLink
            :to="localePath(`/messages/${conversation.id}`)"
            class="flex min-h-touch items-center gap-3 p-4 transition-colors hover:bg-canvas"
          >
            <div class="min-w-0 flex-1">
              <p class="flex items-center gap-2">
                <span
                  class="truncate font-semibold"
                  :class="conversation.unread ? 'text-ink' : 'text-muted'"
                >
                  {{ conversation.other.displayName }}
                </span>
                <span
                  v-if="conversation.unread"
                  class="h-2 w-2 shrink-0 rounded-full bg-orange"
                  :aria-label="t('messaging.title')"
                />
              </p>
              <p class="mt-0.5 truncate text-sm text-grey">{{ conversation.listing.title }}</p>
            </div>

            <p v-if="conversation.lastMessageAt" class="tabular shrink-0 text-xs text-grey">
              {{ format.date(conversation.lastMessageAt) }}
            </p>
          </NuxtLink>
        </li>
      </ul>
    </template>

    <div v-else class="card-surface mt-6 p-8 text-center">
      <MessageSquare class="mx-auto h-8 w-8 text-grey" aria-hidden="true" />
      <p class="mt-3 text-sm text-muted">{{ t('messaging.empty') }}</p>
      <p class="mt-1 text-xs text-grey">{{ t('messaging.emptyHint') }}</p>
      <NuxtLink :to="localePath('/recherche')" class="btn-primary mt-4">
        {{ t('messaging.browse') }}
      </NuxtLink>
    </div>
  </div>
</template>
