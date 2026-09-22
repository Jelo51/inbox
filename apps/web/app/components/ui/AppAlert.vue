<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{ tone?: 'info' | 'success' | 'warning' | 'error'; title?: string }>(),
  { tone: 'info', title: undefined },
);

const icons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
} as const;

const tones = {
  info: 'border-line bg-card text-muted',
  success: 'border-success/30 bg-success/5 text-ink',
  warning: 'border-pending/30 bg-pending/5 text-ink',
  error: 'border-danger/30 bg-danger/5 text-ink',
} as const;

const iconTones = {
  info: 'text-grey',
  success: 'text-success',
  warning: 'text-pending',
  error: 'text-danger',
} as const;

const icon = computed(() => icons[props.tone]);
</script>

<template>
  <div
    class="flex items-start gap-3 rounded-card border p-4 text-sm leading-relaxed"
    :class="tones[tone]"
    :role="tone === 'error' ? 'alert' : 'status'"
  >
    <component
      :is="icon"
      class="mt-0.5 h-5 w-5 shrink-0"
      :class="iconTones[tone]"
      aria-hidden="true"
    />
    <div class="min-w-0">
      <p v-if="title" class="font-semibold text-ink">{{ title }}</p>
      <div :class="title ? 'mt-1' : ''"><slot /></div>
    </div>
  </div>
</template>
