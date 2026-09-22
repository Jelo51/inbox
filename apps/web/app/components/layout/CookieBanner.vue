<script setup lang="ts">
/**
 * Bannière de consentement.
 *
 * Elle ne s'affiche **que** si un traceur soumis à consentement est configuré,
 * ce que le serveur seul sait. La mesure d'audience retenue aujourd'hui — Umami
 * auto-hébergé — ne pose aucun cookie et n'exige donc aucun accord : afficher
 * une bannière à son sujet serait à la fois inutile et trompeur, puisqu'elle
 * ferait croire à un choix qui n'existe pas.
 */
const { t } = useI18n();
const localePath = useLocalePath();
const { request } = useApiClient();

const POLICY_VERSION = '1.0';

const visible = ref(false);
const saving = ref(false);

onMounted(async () => {
  try {
    const state = await request<{ required: boolean; consent: { analytics: boolean } | null }>(
      '/consent',
    );
    visible.value = state.required && state.consent === null;
  } catch {
    // Une bannière qui s'affiche à tort vaut mieux que l'inverse, mais une
    // erreur réseau n'est pas une raison d'en afficher une : on se tait.
    visible.value = false;
  }
});

async function decide(analytics: boolean) {
  saving.value = true;
  try {
    await request('/consent', {
      method: 'POST',
      body: { analytics, policyVersion: POLICY_VERSION },
    });
    visible.value = false;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card p-4 shadow-card"
    role="dialog"
    :aria-label="t('cookies.title')"
  >
    <div class="shell flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="flex-1">
        <p class="text-sm font-semibold">{{ t('cookies.title') }}</p>
        <p class="mt-1 text-sm leading-relaxed text-muted">{{ t('cookies.body') }}</p>
        <NuxtLink
          :to="localePath('/legal/cookies')"
          class="mt-1 inline-block text-sm text-orange hover:text-orange-hover"
        >
          {{ t('cookies.more') }}
        </NuxtLink>
      </div>

      <div class="flex shrink-0 gap-2">
        <button type="button" class="btn-secondary" :disabled="saving" @click="decide(false)">
          {{ t('cookies.refuse') }}
        </button>
        <button type="button" class="btn-primary" :disabled="saving" @click="decide(true)">
          {{ t('cookies.accept') }}
        </button>
      </div>
    </div>
  </div>
</template>
