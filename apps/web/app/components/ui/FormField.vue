<script setup lang="ts">
import { CircleAlert } from 'lucide-vue-next';

/**
 * Champ de formulaire accessible : l'étiquette est liée au champ, l'aide et
 * l'erreur sont annoncées par `aria-describedby`, et l'erreur est signalée
 * autrement que par la seule couleur.
 */
const props = defineProps<{
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  optionalLabel?: string;
}>();

const hintId = computed(() => `${props.id}-aide`);
const errorId = computed(() => `${props.id}-erreur`);
const describedBy = computed(
  () =>
    [props.hint ? hintId.value : null, props.error ? errorId.value : null]
      .filter(Boolean)
      .join(' ') || undefined,
);
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-sm font-semibold text-ink">
      {{ label }}
      <span v-if="!required && optionalLabel" class="font-normal text-grey">
        ({{ optionalLabel }})
      </span>
    </label>

    <slot v-bind="{ describedBy, invalid: Boolean(error) }" />

    <p v-if="hint" :id="hintId" class="text-xs leading-relaxed text-grey">{{ hint }}</p>

    <p
      v-if="error"
      :id="errorId"
      class="flex items-start gap-1.5 text-xs font-medium leading-relaxed text-danger"
      role="alert"
    >
      <CircleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{{ error }}</span>
    </p>
  </div>
</template>
