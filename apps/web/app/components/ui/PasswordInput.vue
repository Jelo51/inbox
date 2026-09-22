<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next';

defineProps<{
  id: string;
  describedBy?: string | undefined;
  invalid?: boolean;
  autocomplete?: string;
  placeholder?: string;
}>();

const model = defineModel<string>({ required: true });
const visible = ref(false);
const { t } = useI18n();
</script>

<template>
  <div class="relative">
    <input
      :id="id"
      v-model="model"
      :type="visible ? 'text' : 'password'"
      class="field pr-12"
      :class="invalid ? 'border-danger' : ''"
      :aria-describedby="describedBy"
      :aria-invalid="invalid || undefined"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
    />
    <button
      type="button"
      class="absolute right-1 top-1/2 flex h-touch w-touch -translate-y-1/2 items-center justify-center rounded-pill text-grey hover:text-ink"
      :aria-label="visible ? t('auth.login.hidePassword') : t('auth.login.showPassword')"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <component :is="visible ? EyeOff : Eye" class="h-5 w-5" aria-hidden="true" />
    </button>
  </div>
</template>
