<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next';
import { useMessagingStore } from '~/stores/messaging';

const { t } = useI18n();
const messaging = useMessagingStore();

const passphrase = ref('');
const confirmation = ref('');
const saving = ref(false);
const done = ref(false);

const mismatch = computed(
  () => confirmation.value.length > 0 && passphrase.value !== confirmation.value,
);

async function save() {
  if (mismatch.value || !passphrase.value) return;
  saving.value = true;
  try {
    await messaging.saveBackup(passphrase.value);
    done.value = true;
    passphrase.value = '';
    confirmation.value = '';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="card-surface p-5">
    <h2 class="text-base font-bold">{{ t('messaging.encryption.backupTitle') }}</h2>
    <p class="mt-2 text-sm leading-relaxed text-muted">
      {{ t('messaging.encryption.backupText') }}
    </p>

    <p v-if="messaging.identity" class="mt-4">
      <span class="text-xs font-semibold text-grey">
        {{ t('messaging.encryption.myFingerprint') }}
      </span>
      <span class="tabular mt-1 block break-all text-sm font-medium">
        {{ messaging.identity.fingerprint }}
      </span>
    </p>

    <AppAlert v-if="done" tone="success" class="mt-4">
      {{ t('messaging.encryption.backupDone') }}
    </AppAlert>

    <form class="mt-4 flex flex-col gap-4" novalidate @submit.prevent="save">
      <FormField
        id="phrase-sauvegarde"
        :label="t('messaging.encryption.passphrase')"
        :hint="t('messaging.encryption.backupHint')"
        required
      >
        <template #default="{ describedBy }">
          <PasswordInput
            id="phrase-sauvegarde"
            v-model="passphrase"
            autocomplete="new-password"
            :described-by="describedBy"
          />
        </template>
      </FormField>

      <FormField
        id="phrase-confirmation"
        :label="t('messaging.encryption.backupConfirm')"
        :error="mismatch ? t('messaging.encryption.backupMismatch') : null"
        required
      >
        <template #default="{ describedBy, invalid }">
          <PasswordInput
            id="phrase-confirmation"
            v-model="confirmation"
            autocomplete="new-password"
            :described-by="describedBy"
            :invalid="invalid"
          />
        </template>
      </FormField>

      <button
        type="submit"
        class="btn-primary w-full"
        :disabled="saving || mismatch || !passphrase"
      >
        <ShieldCheck class="h-4 w-4" aria-hidden="true" />
        {{ saving ? t('common.loading') : t('messaging.encryption.backup') }}
      </button>
    </form>
  </section>
</template>
