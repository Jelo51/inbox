import { openDB, type IDBPDatabase } from 'idb';
import {
  buildBackup,
  fingerprintOf,
  fromBase64,
  generateIdentity,
  open,
  restoreBackup,
  seal,
  toBase64,
  type Identity,
  type SealedBox,
} from '~/utils/e2ee';

/**
 * Gestion des clés sur l'appareil.
 *
 * La règle qui structure ce fichier : **la clé privée ne quitte jamais
 * l'appareil en clair**. Elle est créée dans `~/utils/e2ee`, rangée ici dans
 * IndexedDB, et n'est transmise au serveur que sous forme de blob chiffré par
 * une phrase secrète que le serveur ne voit jamais.
 */

export type { Identity, SealedBox };
export { fingerprintOf };

const DB_NAME = 'inbox-chiffrement';
const DB_VERSION = 1;
const IDENTITY_STORE = 'identite';
const PEERS_STORE = 'correspondants';
const IDENTITY_KEY = 'moi';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(IDENTITY_STORE)) {
        database.createObjectStore(IDENTITY_STORE);
      }
      if (!database.objectStoreNames.contains(PEERS_STORE)) {
        database.createObjectStore(PEERS_STORE);
      }
    },
  });
  return dbPromise;
}

export function useCrypto() {
  /** Paire de clés de l'appareil, créée une seule fois. */
  async function loadIdentity(): Promise<Identity | null> {
    if (import.meta.server) return null;

    const stored = (await (await db()).get(IDENTITY_STORE, IDENTITY_KEY)) as
      { publicKey: string; secretKey: Uint8Array } | undefined;

    if (!stored) return null;

    return {
      publicKey: stored.publicKey,
      secretKey: new Uint8Array(stored.secretKey),
      fingerprint: fingerprintOf(stored.publicKey),
    };
  }

  async function createIdentity(): Promise<Identity> {
    const created = generateIdentity();
    await (
      await db()
    ).put(
      IDENTITY_STORE,
      { publicKey: created.publicKey, secretKey: created.secretKey },
      IDENTITY_KEY,
    );
    return created;
  }

  async function storeIdentity(publicKey: string, secretKey: Uint8Array): Promise<Identity> {
    await (await db()).put(IDENTITY_STORE, { publicKey, secretKey }, IDENTITY_KEY);
    return { publicKey, secretKey, fingerprint: fingerprintOf(publicKey) };
  }

  /**
   * Efface la clé privée de cet appareil. Sans sauvegarde, les messages déjà
   * reçus deviennent définitivement illisibles — l'interface doit le dire.
   */
  async function forgetIdentity(): Promise<void> {
    const database = await db();
    await database.delete(IDENTITY_STORE, IDENTITY_KEY);
    await database.clear(PEERS_STORE);
  }

  // ── Empreintes des correspondants ────────────────────────────────────────

  /**
   * Mémorise l'empreinte vue pour un correspondant. Si elle change, soit il a
   * réinstallé l'application, soit quelqu'un s'interpose : dans les deux cas,
   * l'utilisateur doit être averti plutôt que de continuer sans rien voir.
   */
  async function rememberPeer(userId: string, fingerprint: string): Promise<void> {
    await (await db()).put(PEERS_STORE, { fingerprint, seenAt: Date.now() }, userId);
  }

  async function knownPeerFingerprint(userId: string): Promise<string | null> {
    const stored = (await (await db()).get(PEERS_STORE, userId)) as
      { fingerprint: string } | undefined;
    return stored?.fingerprint ?? null;
  }

  return {
    loadIdentity,
    createIdentity,
    storeIdentity,
    forgetIdentity,
    seal,
    open,
    buildBackup,
    restoreBackup,
    rememberPeer,
    knownPeerFingerprint,
    fingerprintOf,
    toBase64,
    fromBase64,
  };
}
