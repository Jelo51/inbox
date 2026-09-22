<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useMessagingStore } from '~/stores/messaging';
import { useApiError } from '~/composables/useApiError';

definePageMeta({ middleware: 'auth' });

/**
 * Point d'entrée depuis une fiche annonce. Une conversation ne peut naître que
 * là : ce détour garantit qu'un identifiant d'annonce accompagne toujours la
 * création, et évite d'ouvrir un canal de démarchage à froid.
 */
const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const auth = useAuthStore();
const messaging = useMessagingStore();
const apiError = useApiError();

const error = ref<unknown>(null);
const ready = ref(false);

useHead({ title: () => `${t('messaging.title')} — ${t('app.name')}` });

onMounted(async () => {
  const listingId = typeof route.query.annonce === 'string' ? route.query.annonce : null;
  if (!listingId) {
    await navigateTo(localePath('/messages'));
    return;
  }

  await messaging.initKeys();
  if (messaging.keyState !== 'pret') {
    ready.value = true;
    return;
  }

  try {
    const { conversation } = await auth.authedRequest<{ conversation: { id: string } }>(
      '/conversations',
      { method: 'POST', body: { listingId } },
    );
    await navigateTo(localePath(`/messages/${conversation.id}`), { replace: true });
  } catch (err) {
    error.value = err;
    ready.value = true;
  }
});
</script>

<template>
  <div class="shell max-w-lg py-8">
    <p v-if="!ready" class="text-sm text-muted">{{ t('common.loading') }}</p>

    <AppAlert v-else-if="error" tone="error">{{ apiError.message(error) }}</AppAlert>

    <KeySetup v-else />
  </div>
</template>
