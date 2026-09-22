import { defineStore } from 'pinia';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '~/stores/auth';
import { useCrypto, type Identity } from '~/composables/useCrypto';

export interface ConversationSummary {
  id: string;
  listing: {
    id: string;
    slug: string;
    title: string;
    price: number;
    priceUnit: string;
    imagePublicId: string | null;
  };
  other: { id: string; displayName: string; isPro: boolean };
  lastMessageAt: string | null;
  unread: boolean;
}

export interface EncryptedMessage {
  id: string;
  senderId: string;
  ciphertext: string;
  nonce: string;
  senderCiphertext: string;
  senderNonce: string;
  recipientKeyId: string;
  senderKeyId: string;
  readAt: string | null;
  createdAt: string;
}

export interface DecryptedMessage {
  id: string;
  senderId: string;
  fromMe: boolean;
  /** `null` quand le message ne peut pas être ouvert avec la clé de cet appareil. */
  text: string | null;
  createdAt: string;
  readAt: string | null;
}

export type KeyState =
  | 'inconnu'
  | 'absent'
  /** Le serveur connaît une clé publique dont cet appareil n'a pas la privée. */
  | 'a-restaurer'
  | 'pret';

export const useMessagingStore = defineStore('messagerie', () => {
  const auth = useAuthStore();
  const crypto = useCrypto();
  const config = useRuntimeConfig();

  const identity = ref<Identity | null>(null);
  const keyState = ref<KeyState>('inconnu');
  const conversations = ref<ConversationSummary[]>([]);
  const messages = ref<DecryptedMessage[]>([]);
  const activeConversationId = ref<string | null>(null);
  const peerKey = ref<{ publicKey: string; fingerprint: string } | null>(null);
  /** Vrai quand l'empreinte du correspondant a changé depuis la dernière fois. */
  const peerKeyChanged = ref(false);

  let socket: Socket | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const unreadCount = computed(() => conversations.value.filter((c) => c.unread).length);

  // ── Clés ──────────────────────────────────────────────────────────────────

  /**
   * Décide de l'état du chiffrement sur cet appareil : clé locale présente,
   * clé à créer, ou clé existante côté serveur qu'il faut restaurer.
   */
  async function initKeys(): Promise<KeyState> {
    if (!auth.isAuthenticated) return (keyState.value = 'inconnu');

    const local = await crypto.loadIdentity();
    const remote = await auth.authedRequest<{ key: { publicKey: string } | null }>('/keys/me');

    if (local && remote.key?.publicKey === local.publicKey) {
      identity.value = local;
      return (keyState.value = 'pret');
    }

    if (remote.key && !local) return (keyState.value = 'a-restaurer');

    if (local && !remote.key) {
      // L'appareil a la clé mais le serveur l'ignore : on la réenregistre.
      await publishKey(local);
      identity.value = local;
      return (keyState.value = 'pret');
    }

    return (keyState.value = 'absent');
  }

  async function publishKey(newIdentity: Identity): Promise<void> {
    await auth.authedRequest('/keys', {
      method: 'POST',
      body: {
        publicKey: newIdentity.publicKey,
        fingerprint: newIdentity.fingerprint,
        deviceLabel: navigator.userAgent.slice(0, 80),
      },
    });
  }

  async function createKeys(): Promise<Identity> {
    const created = await crypto.createIdentity();
    await publishKey(created);
    identity.value = created;
    keyState.value = 'pret';
    return created;
  }

  async function saveBackup(passphrase: string): Promise<void> {
    if (!identity.value) throw new Error('aucune clé à sauvegarder');
    const payload = crypto.buildBackup(identity.value, passphrase);
    await auth.authedRequest('/keys/backup', { method: 'PUT', body: payload });
  }

  async function restoreFromBackup(passphrase: string): Promise<boolean> {
    const { backup } = await auth.authedRequest<{
      backup: {
        encryptedPrivateKey: string;
        salt: string;
        nonce: string;
        kdfParams: { memoryKiB: number; iterations: number; parallelism: number };
      };
    }>('/keys/backup/mine');

    const secretKey = crypto.restoreBackup(backup, passphrase);
    // Phrase secrète fausse : rien d'autre ne permet de le savoir, la
    // vérification est le déchiffrement lui-même.
    if (!secretKey) return false;

    const remote = await auth.authedRequest<{ key: { publicKey: string } | null }>('/keys/me');
    if (!remote.key) return false;

    identity.value = await crypto.storeIdentity(remote.key.publicKey, secretKey);
    keyState.value = 'pret';
    return true;
  }

  async function resetKeys(): Promise<Identity> {
    await crypto.forgetIdentity();
    return createKeys();
  }

  // ── Conversations ─────────────────────────────────────────────────────────

  async function loadConversations(): Promise<void> {
    conversations.value = (
      await auth.authedRequest<{ items: ConversationSummary[] }>('/conversations')
    ).items;
  }

  function decrypt(raw: EncryptedMessage, myId: string, otherPublicKey: string): DecryptedMessage {
    const fromMe = raw.senderId === myId;
    let text: string | null = null;

    if (identity.value) {
      text = fromMe
        ? // Copie destinée à l'expéditeur : chiffrée pour lui-même.
          crypto.open(
            { ciphertext: raw.senderCiphertext, nonce: raw.senderNonce },
            identity.value.publicKey,
            identity.value.secretKey,
          )
        : crypto.open(
            { ciphertext: raw.ciphertext, nonce: raw.nonce },
            otherPublicKey,
            identity.value.secretKey,
          );
    }

    return {
      id: raw.id,
      senderId: raw.senderId,
      fromMe,
      text,
      createdAt: raw.createdAt,
      readAt: raw.readAt,
    };
  }

  async function openConversation(conversationId: string): Promise<void> {
    activeConversationId.value = conversationId;

    const { conversation } = await auth.authedRequest<{
      conversation: {
        other: { id: string; publicKey: string | null; fingerprint: string | null };
      };
    }>(`/conversations/${conversationId}`);

    peerKey.value = conversation.other.publicKey
      ? { publicKey: conversation.other.publicKey, fingerprint: conversation.other.fingerprint! }
      : null;

    if (peerKey.value) {
      const known = await crypto.knownPeerFingerprint(conversation.other.id);
      peerKeyChanged.value = known !== null && known !== peerKey.value.fingerprint;
      await crypto.rememberPeer(conversation.other.id, peerKey.value.fingerprint);
    }

    await loadMessages();
    await auth.authedRequest(`/conversations/${conversationId}/read`, { method: 'POST' });
  }

  async function loadMessages(): Promise<void> {
    if (!activeConversationId.value || !auth.user) return;

    const { items } = await auth.authedRequest<{ items: EncryptedMessage[] }>(
      `/conversations/${activeConversationId.value}/messages`,
      { query: { limit: 60 } },
    );

    messages.value = items.map((raw) =>
      decrypt(raw, auth.user!.id, peerKey.value?.publicKey ?? ''),
    );
  }

  async function send(text: string): Promise<void> {
    if (!identity.value || !peerKey.value || !activeConversationId.value) {
      throw new Error('messagerie non prête');
    }

    const forPeer = crypto.seal(text, peerKey.value.publicKey, identity.value.secretKey);
    // Copie chiffrée pour soi : sans elle, on ne pourrait pas relire ses
    // propres messages après restauration sur un autre appareil.
    const forMe = crypto.seal(text, identity.value.publicKey, identity.value.secretKey);

    await auth.authedRequest('/messages', {
      method: 'POST',
      body: {
        conversationId: activeConversationId.value,
        ciphertext: forPeer.ciphertext,
        nonce: forPeer.nonce,
        senderCiphertext: forMe.ciphertext,
        senderNonce: forMe.nonce,
      },
    });

    await loadMessages();
  }

  /** Déchiffre le fil courant pour un signalement transmis volontairement. */
  function disclosableMessages() {
    return messages.value
      .filter((message) => message.text !== null)
      .map((message) => ({
        messageId: message.id,
        sentAt: message.createdAt,
        fromMe: message.fromMe,
        plaintext: message.text!,
      }));
  }

  // ── Temps réel ────────────────────────────────────────────────────────────

  /**
   * WebSocket quand il passe, interrogation périodique sinon. Les réseaux
   * mobiles coupent souvent les connexions longues : le repli n'est pas une
   * précaution théorique.
   */
  function connectRealtime(): void {
    if (socket || !auth.accessToken) return;

    // Base relative : le temps réel vit sur la même origine que le site.
    const origin = config.public.apiBase.startsWith('http')
      ? new URL(config.public.apiBase).origin
      : window.location.origin;

    socket = io(origin, {
      path: '/api/v1/realtime',
      auth: { token: auth.accessToken },
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 10_000,
    });

    socket.on('message:new', (raw: EncryptedMessage & { conversationId: string }) => {
      if (raw.conversationId === activeConversationId.value) {
        void loadMessages();
      }
      void loadConversations();
    });

    socket.on('connect_error', () => {
      startPolling();
    });
  }

  function startPolling(): void {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      void loadConversations();
      if (activeConversationId.value) void loadMessages();
    }, 15_000);
  }

  function disconnectRealtime(): void {
    socket?.disconnect();
    socket = null;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return {
    identity,
    keyState,
    conversations,
    messages,
    activeConversationId,
    peerKey,
    peerKeyChanged,
    unreadCount,
    initKeys,
    createKeys,
    resetKeys,
    saveBackup,
    restoreFromBackup,
    loadConversations,
    openConversation,
    loadMessages,
    send,
    disclosableMessages,
    connectRealtime,
    disconnectRealtime,
  };
});
