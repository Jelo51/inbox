<script setup lang="ts">
import { KeyRound, Lock, ShieldCheck } from 'lucide-vue-next';
import { useMessagingStore } from '~/stores/messaging';
import { ApiError } from '~/composables/useApiClient';

/**
 * Écran d'activation du chiffrement. Il explique en clair ce que le serveur
 * voit et ne voit pas : une promesse de confidentialité que l'utilisateur ne
 * comprend pas ne vaut rien.
 */
const { t } = useI18n();
const messaging = useMessagingStore();

const passphrase = ref('');
const restoring = ref(false);
const creating = ref(false);
const error = ref<string | null>(null);

async function create() {
  creating.value = true;
  error.value = null;
  try {
    await messaging.createKeys();
  } finally {
    creating.value = false;
  }
}

async function restore() {
  restoring.value = true;
  error.value = null;
  try {
    const ok = await messaging.restoreFromBackup(passphrase.value);
    if (!ok) error.value = t('messaging.encryption.restoreFailed');
  } catch (err) {
    error.value =
      err instanceof ApiError && err.status === 404
        ? t('messaging.encryption.restoreNoBackup')
        : t('messaging.encryption.restoreFailed');
  } finally {
    restoring.value = false;
    passphrase.value = '';
  }
}

async function reset() {
  if (!globalThis.confirm(t('messaging.encryption.resetConfirm'))) return;
  creating.value = true;
  try {
    await messaging.resetKeys();
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <div class="card-surface mx-auto max-w-lg p-6">
    <h2 class="flex items-center gap-2 text-lg font-bold">
      <Lock class="h-5 w-5 text-orange" aria-hidden="true" />
      {{ t('messaging.encryption.title') }}
    </h2>

    <div class="mt-4 rounded-card bg-orange-soft p-4 text-sm leading-relaxed">
      <p class="font-semibold text-ink">{{ t('messaging.encryption.explainTitle') }}</p>
      <p class="mt-2 text-muted">{{ t('messaging.encryption.explain') }}</p>
      <p class="mt-2 flex items-start gap-2 text-muted">
        <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        <span>{{ t('messaging.encryption.keyStays') }}</span>
      </p>
    </div>

    <AppAlert v-if="error" tone="error" class="mt-4">{{ error }}</AppAlert>

    <template v-if="messaging.keyState === 'absent'">
      <h3 class="mt-6 text-base font-semibold">{{ t('messaging.encryption.createTitle') }}</h3>
      <p class="mt-1 text-sm text-muted">{{ t('messaging.encryption.createText') }}</p>
      <button type="button" class="btn-primary mt-4 w-full" :disabled="creating" @click="create">
        <KeyRound class="h-4 w-4" aria-hidden="true" />
        {{ creating ? t('common.loading') : t('messaging.encryption.create') }}
      </button>
    </template>

    <template v-else-if="messaging.keyState === 'a-restaurer'">
      <h3 class="mt-6 text-base font-semibold">{{ t('messaging.encryption.restoreTitle') }}</h3>
      <p class="mt-1 text-sm leading-relaxed text-muted">
        {{ t('messaging.encryption.restoreText') }}
      </p>

      <form class="mt-4 flex flex-col gap-4" novalidate @submit.prevent="restore">
        <FormField id="phrase" :label="t('messaging.encryption.passphrase')" required>
          <template #default="{ describedBy }">
            <PasswordInput
              id="phrase"
              v-model="passphrase"
              autocomplete="off"
              :described-by="describedBy"
            />
          </template>
        </FormField>

        <button type="submit" class="btn-primary w-full" :disabled="restoring || !passphrase">
          {{ restoring ? t('common.loading') : t('messaging.encryption.restore') }}
        </button>
      </form>

      <details class="mt-6">
        <summary class="cursor-pointer text-sm font-semibold text-muted">
          {{ t('messaging.encryption.resetTitle') }}
        </summary>
        <p class="mt-2 text-sm leading-relaxed text-muted">
          {{ t('messaging.encryption.resetText') }}
        </p>
        <button type="button" class="btn-secondary mt-3 w-full text-danger" @click="reset">
          {{ t('messaging.encryption.reset') }}
        </button>
      </details>
    </template>
  </div>
</template>
