import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer, type Socket } from 'socket.io';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../../config/env.js';
import type { Logger } from '../../lib/logger.js';
import { verifyAccessToken } from '../auth/tokens.js';
import { isSessionActive } from '../auth/sessions.js';
import { now } from '../../lib/clock.js';

/**
 * Charge utile poussée en temps réel. Elle est identique à ce que renvoie
 * l'API REST : uniquement du chiffré et des métadonnées. Le canal temps réel
 * n'est pas une porte dérobée.
 */
export interface RealtimeMessage {
  id: string;
  conversationId: string;
  senderId: string;
  ciphertext: string;
  nonce: string;
  senderCiphertext: string;
  senderNonce: string;
  recipientKeyId: string;
  senderKeyId: string;
  createdAt: string;
}

export interface RealtimeHub {
  notifyMessage(userId: string, message: RealtimeMessage): void;
  attach(server: HttpServer): void;
  close(): Promise<void>;
  readonly connectedUsers: number;
}

/**
 * Hub inerte, utilisé par les tests et quand le temps réel est désactivé.
 * Le client bascule alors sur son repli en interrogation périodique.
 */
export function createNoopHub(): RealtimeHub {
  return {
    notifyMessage() {},
    attach() {},
    close: () => Promise.resolve(),
    connectedUsers: 0,
  };
}

export function createRealtimeHub(env: Env, prisma: PrismaClient, logger: Logger): RealtimeHub {
  let io: SocketServer | null = null;

  /**
   * Chaque utilisateur a sa propre salle, nommée par son identifiant. Diffuser
   * dans une salle par conversation obligerait à gérer les entrées et sorties
   * à chaque ouverture de fil ; une salle par personne suffit et ne fuit rien.
   */
  const room = (userId: string) => `u:${userId}`;

  async function authenticate(socket: Socket): Promise<string | null> {
    const token =
      (socket.handshake.auth as { token?: unknown } | undefined)?.token ??
      socket.handshake.headers.authorization?.replace(/^Bearer /, '');

    if (typeof token !== 'string' || token.length === 0) return null;

    try {
      const claims = await verifyAccessToken(token);
      // Une session révoquée doit fermer la connexion temps réel aussi vite
      // qu'elle ferme l'accès REST.
      if (!(await isSessionActive(prisma, claims.sessionId, now()))) return null;
      return claims.userId;
    } catch {
      return null;
    }
  }

  return {
    get connectedUsers() {
      return io?.sockets.sockets.size ?? 0;
    },

    attach(server: HttpServer) {
      io = new SocketServer(server, {
        path: '/api/v1/realtime',
        cors: { origin: env.corsOrigins, credentials: true },
        // Le repli en interrogation périodique est explicitement conservé :
        // les réseaux mobiles camerounais coupent souvent les WebSockets.
        transports: ['websocket', 'polling'],
        serveClient: false,
      });

      io.use((socket, next) => {
        void authenticate(socket).then((userId) => {
          if (!userId) return next(new Error('non authentifié'));
          socket.data.userId = userId;
          next();
        });
      });

      io.on('connection', (socket) => {
        const userId = socket.data.userId as string;
        void socket.join(room(userId));

        socket.on('disconnect', () => {
          logger.debug({ userId }, 'déconnexion temps réel');
        });
      });

      logger.info('temps réel actif');
    },

    notifyMessage(userId, message) {
      io?.to(room(userId)).emit('message:new', message);
    },

    async close() {
      await io?.close();
      io = null;
    },
  };
}
