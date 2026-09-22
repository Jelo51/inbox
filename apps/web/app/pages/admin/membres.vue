<script setup lang="ts">
import { Search } from 'lucide-vue-next';
import { USER_ROLES, USER_STATUSES } from '@inbox/shared';
import { useAuthStore } from '~/stores/auth';
import { useApiError } from '~/composables/useApiError';
import { useFormat } from '~/composables/useFormat';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface UserRow {
  id: string;
  emailMasked: string;
  displayName: string;
  role: string;
  status: string;
  emailVerified: boolean;
  suspendedUntil: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  listingCount: number;
  reportCount: number;
}

interface UserDetail {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  bio: string | null;
  suspendedUntil: string | null;
  suspendedFor: string | null;
  bannedFor: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  listings: { id: string; title: string; status: string; createdAt: string }[];
  reports: { id: string; reason: string; status: string; createdAt: string }[];
  subscription: { status: string; planName: string; endsAt: string | null } | null;
}

const { t } = useI18n();
const auth = useAuthStore();
const apiError = useApiError();
const format = useFormat();

const items = ref<UserRow[]>([]);
const selected = ref<UserDetail | null>(null);
const search = ref('');
const roleFilter = ref('');
const statusFilter = ref('');
const loading = ref(true);
const busy = ref(false);
const error = ref<unknown>(null);

const action = ref<'suspend' | 'ban' | 'role' | null>(null);
const days = ref(7);
const reason = ref('');
const newRole = ref<(typeof USER_ROLES)[number]>('USER');

useHead({ title: () => `${t('admin.users.title')} — ${t('admin.title')}` });

const isAdmin = computed(() => auth.user?.role === 'ADMIN');

async function load() {
  loading.value = true;
  try {
    items.value = (
      await auth.authedRequest<{ items: UserRow[] }>('/admin/users', {
        query: {
          limit: 30,
          ...(search.value.trim() && { search: search.value.trim() }),
          ...(roleFilter.value && { role: roleFilter.value }),
          ...(statusFilter.value && { status: statusFilter.value }),
        },
      })
    ).items;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function openUser(id: string) {
  error.value = null;
  action.value = null;
  reason.value = '';
  selected.value = (await auth.authedRequest<{ user: UserDetail }>(`/admin/users/${id}`)).user;
  newRole.value = selected.value.role as (typeof USER_ROLES)[number];
}

async function submit() {
  if (!selected.value || !action.value) return;
  busy.value = true;
  error.value = null;

  const id = selected.value.id;

  try {
    if (action.value === 'suspend') {
      await auth.authedRequest(`/admin/users/${id}/suspend`, {
        method: 'POST',
        body: { days: Number(days.value), reason: reason.value },
      });
    } else if (action.value === 'ban') {
      await auth.authedRequest(`/admin/users/${id}/ban`, {
        method: 'POST',
        body: { reason: reason.value },
      });
    } else {
      await auth.authedRequest(`/admin/users/${id}/role`, {
        method: 'POST',
        body: { role: newRole.value, reason: reason.value },
      });
    }
    selected.value = null;
    await load();
  } catch (err) {
    error.value = err;
  } finally {
    busy.value = false;
  }
}

async function unsuspend(id: string) {
  busy.value = true;
  try {
    await auth.authedRequest(`/admin/users/${id}/unsuspend`, { method: 'POST' });
    selected.value = null;
    await load();
  } finally {
    busy.value = false;
  }
}

const statusTone: Record<string, string> = {
  ACTIVE: 'bg-success/10 text-success',
  SUSPENDED: 'bg-pending/10 text-pending',
  BANNED: 'bg-danger/10 text-danger',
  DELETED: 'bg-canvas text-grey',
};

const isStaff = computed(
  () => selected.value?.role === 'MODERATOR' || selected.value?.role === 'ADMIN',
);
</script>

<template>
  <div class="shell max-w-5xl">
    <h1 class="text-xl font-bold tracking-tight">{{ t('admin.users.title') }}</h1>

    <form class="mt-4 flex flex-wrap gap-3" @submit.prevent="load">
      <div class="relative min-w-[16rem] flex-1">
        <label for="recherche-membre" class="sr-only">{{ t('admin.users.search') }}</label>
        <Search
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey"
          aria-hidden="true"
        />
        <input
          id="recherche-membre"
          v-model="search"
          type="search"
          class="field pl-9"
          :placeholder="t('admin.users.searchPlaceholder')"
        />
      </div>

      <label for="filtre-role" class="sr-only">{{ t('admin.users.role') }}</label>
      <select id="filtre-role" v-model="roleFilter" class="field max-w-[12rem]" @change="load">
        <option value="">{{ t('admin.users.allRoles') }}</option>
        <option v-for="role in USER_ROLES" :key="role" :value="role">
          {{ t(`admin.users.roles.${role}`) }}
        </option>
      </select>

      <label for="filtre-statut-membre" class="sr-only">{{ t('admin.users.status') }}</label>
      <select
        id="filtre-statut-membre"
        v-model="statusFilter"
        class="field max-w-[12rem]"
        @change="load"
      >
        <option value="">{{ t('admin.users.allStatuses') }}</option>
        <option v-for="status in USER_STATUSES" :key="status" :value="status">
          {{ t(`admin.users.statuses.${status}`) }}
        </option>
      </select>

      <button type="submit" class="btn-primary">{{ t('listing.search.submit') }}</button>
    </form>

    <p v-if="loading" class="mt-6 text-sm text-muted">{{ t('common.loading') }}</p>

    <p v-else-if="!items.length" class="mt-6 text-sm text-muted">{{ t('admin.users.empty') }}</p>

    <ul
      v-else
      class="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-card"
    >
      <li v-for="user in items" :key="user.id">
        <button
          type="button"
          class="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-canvas"
          @click="openUser(user.id)"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ user.displayName }}</p>
            <!-- L'adresse n'apparaît qu'au détail : un écran partagé ne doit
                 pas exposer les adresses de toute la base. -->
            <p class="tabular mt-0.5 truncate text-xs text-grey">{{ user.emailMasked }}</p>
          </div>

          <p class="tabular hidden shrink-0 text-xs text-grey sm:block">
            {{ user.listingCount }} ann.
            <span v-if="user.reportCount > 0" class="font-semibold text-danger">
              · {{ user.reportCount }} sign.
            </span>
          </p>

          <span class="shrink-0 text-xs font-medium text-muted">
            {{ t(`admin.users.roles.${user.role}`) }}
          </span>

          <span
            class="shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold"
            :class="statusTone[user.status]"
          >
            {{ t(`admin.users.statuses.${user.status}`) }}
          </span>
        </button>
      </li>
    </ul>

    <!-- Détail -->
    <div
      v-if="selected"
      class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="selected.displayName"
    >
      <div
        class="max-h-full w-full max-w-xl overflow-y-auto rounded-t-card bg-card p-5 sm:rounded-card"
      >
        <h2 class="text-lg font-bold">{{ selected.displayName }}</h2>
        <p class="tabular mt-1 text-sm text-muted">{{ selected.email }}</p>
        <p class="mt-1 text-xs text-grey">
          {{ t('admin.users.memberSince', { date: format.date(selected.createdAt) }) }}
          <template v-if="selected.lastLoginAt">
            · {{ t('admin.users.lastLogin', { date: format.date(selected.lastLoginAt) }) }}
          </template>
        </p>

        <AppAlert v-if="selected.status === 'SUSPENDED'" tone="warning" class="mt-4">
          {{ selected.suspendedFor }}
          <template v-if="selected.suspendedUntil">
            — {{ format.date(selected.suspendedUntil) }}
          </template>
        </AppAlert>
        <AppAlert v-if="selected.status === 'BANNED'" tone="error" class="mt-4">
          {{ selected.bannedFor }}
        </AppAlert>
        <AppAlert v-if="isStaff" tone="info" class="mt-4">
          {{ t('admin.users.staffProtected') }}
        </AppAlert>
        <AppAlert v-if="error" tone="error" class="mt-4">{{ apiError.message(error) }}</AppAlert>

        <dl class="mt-4 grid grid-cols-3 gap-3 text-center">
          <div class="rounded-card bg-canvas p-3">
            <dt class="text-xs text-grey">{{ t('admin.users.listings') }}</dt>
            <dd class="tabular mt-1 font-bold">{{ selected.listings.length }}</dd>
          </div>
          <div class="rounded-card bg-canvas p-3">
            <dt class="text-xs text-grey">{{ t('admin.users.reportsReceived') }}</dt>
            <dd
              class="tabular mt-1 font-bold"
              :class="selected.reports.length ? 'text-danger' : ''"
            >
              {{ selected.reports.length }}
            </dd>
          </div>
          <div class="rounded-card bg-canvas p-3">
            <dt class="text-xs text-grey">{{ t('admin.users.role') }}</dt>
            <dd class="mt-1 text-sm font-bold">{{ t(`admin.users.roles.${selected.role}`) }}</dd>
          </div>
        </dl>

        <!-- Actions -->
        <div v-if="!action" class="mt-5 flex flex-wrap gap-2">
          <button type="button" class="btn-secondary flex-1" @click="selected = null">
            {{ t('common.close') }}
          </button>
          <button
            v-if="selected.status === 'SUSPENDED'"
            type="button"
            class="btn-secondary flex-1"
            :disabled="busy"
            @click="unsuspend(selected.id)"
          >
            {{ t('admin.users.unsuspend') }}
          </button>
          <button
            v-if="!isStaff && selected.status === 'ACTIVE'"
            type="button"
            class="btn-secondary flex-1"
            @click="action = 'suspend'"
          >
            {{ t('admin.users.suspend') }}
          </button>
          <button
            v-if="!isStaff && selected.status !== 'BANNED'"
            type="button"
            class="btn-secondary flex-1 text-danger"
            @click="action = 'ban'"
          >
            {{ t('admin.users.ban') }}
          </button>
          <button
            v-if="isAdmin && selected.id !== auth.user?.id"
            type="button"
            class="btn-ghost flex-1"
            @click="action = 'role'"
          >
            {{ t('admin.users.changeRole') }}
          </button>
        </div>

        <form v-else class="mt-5 flex flex-col gap-4" @submit.prevent="submit">
          <FormField
            v-if="action === 'suspend'"
            id="duree"
            :label="t('admin.users.suspendDays')"
            required
          >
            <template #default="{ describedBy }">
              <input
                id="duree"
                v-model="days"
                type="number"
                min="1"
                max="365"
                class="field tabular"
                :aria-describedby="describedBy"
              />
            </template>
          </FormField>

          <FormField
            v-if="action === 'role'"
            id="nouveau-role"
            :label="t('admin.users.role')"
            required
          >
            <template #default="{ describedBy }">
              <select
                id="nouveau-role"
                v-model="newRole"
                class="field"
                :aria-describedby="describedBy"
              >
                <option v-for="role in USER_ROLES" :key="role" :value="role">
                  {{ t(`admin.users.roles.${role}`) }}
                </option>
              </select>
            </template>
          </FormField>

          <FormField
            id="motif-action"
            :label="t('admin.users.actionReason')"
            :hint="action !== 'role' ? t('admin.users.actionReasonHint') : undefined"
            required
          >
            <template #default="{ describedBy }">
              <textarea
                id="motif-action"
                v-model="reason"
                rows="2"
                maxlength="500"
                required
                class="field py-2"
                :aria-describedby="describedBy"
              />
            </template>
          </FormField>

          <div class="flex gap-2">
            <button type="button" class="btn-secondary flex-1" @click="action = null">
              {{ t('common.cancel') }}
            </button>
            <button
              type="submit"
              class="btn-primary flex-1"
              :disabled="busy || reason.trim().length < 5"
            >
              {{ t('admin.users.confirm') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
