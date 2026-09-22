import { createHash, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Env } from '../../config/env.js';
import type { Logger } from '../../lib/logger.js';

export interface StoredImage {
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

export interface ImageStorage {
  readonly name: string;
  upload(data: Buffer, meta: Omit<StoredImage, 'publicId'>): Promise<StoredImage>;
  remove(publicId: string): Promise<void>;
  url(publicId: string, variant: 'full' | 'thumb'): string;
}

/**
 * Stockage disque local, pour le développement et les tests : sans lui, il
 * faudrait un compte Cloudinary pour seulement lancer le projet.
 */
function localStorage(env: Env, logger: Logger): ImageStorage {
  const root = join(process.cwd(), 'uploads');

  return {
    name: 'local',

    async upload(data, meta) {
      const publicId = `annonces/${randomUUID()}`;
      const path = join(root, `${publicId}.webp`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
      return { publicId, ...meta };
    },

    async remove(publicId) {
      try {
        await unlink(join(root, `${publicId}.webp`));
      } catch (err) {
        // Un fichier déjà absent n'est pas une erreur : la suppression est idempotente.
        logger.debug({ publicId, err }, 'fichier image déjà absent');
      }
    },

    url(publicId) {
      return `${env.API_URL}/media/${publicId}.webp`;
    },
  };
}

/**
 * Cloudinary. Le téléversement est signé côté serveur : le navigateur n'a
 * jamais accès au secret d'API, et ne peut donc pas déposer ce qu'il veut sur
 * le compte.
 */
function cloudinaryStorage(env: Env, logger: Logger): ImageStorage {
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  const key = env.CLOUDINARY_API_KEY;
  const secret = env.CLOUDINARY_API_SECRET;

  function sign(params: Record<string, string>): string {
    const canonical = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    return createHash('sha1').update(`${canonical}${secret}`).digest('hex');
  }

  return {
    name: 'cloudinary',

    async upload(data, meta) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const folder = 'inbox/annonces';
      const signature = sign({ folder, timestamp });

      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(data)], { type: 'image/webp' }));
      form.append('api_key', key!);
      form.append('timestamp', timestamp);
      form.append('folder', folder);
      form.append('signature', signature);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
        method: 'POST',
        body: form,
      });

      if (!response.ok) {
        const body = await response.text();
        logger.error({ status: response.status, body }, 'téléversement Cloudinary en échec');
        throw new Error(`Cloudinary a répondu ${response.status}`);
      }

      const payload = (await response.json()) as { public_id: string };
      return { publicId: payload.public_id, ...meta };
    },

    async remove(publicId) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = sign({ public_id: publicId, timestamp });

      const form = new FormData();
      form.append('public_id', publicId);
      form.append('api_key', key!);
      form.append('timestamp', timestamp);
      form.append('signature', signature);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
        method: 'POST',
        body: form,
      });

      if (!response.ok) {
        logger.error({ publicId, status: response.status }, 'suppression Cloudinary en échec');
      }
    },

    url(publicId, variant) {
      // Transformation à la volée : `f_auto` sert du WebP ou de l'AVIF selon
      // le navigateur, ce qui compte sur une connexion mobile.
      const transform =
        variant === 'thumb' ? 'c_fill,w_480,h_480,q_auto,f_auto' : 'c_limit,w_1400,q_auto,f_auto';
      return `https://res.cloudinary.com/${cloud}/image/upload/${transform}/${publicId}`;
    },
  };
}

export function createImageStorage(env: Env, logger: Logger): ImageStorage {
  const configured =
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET;

  if (configured) return cloudinaryStorage(env, logger);

  if (env.isProduction) {
    // Inatteignable : la validation de configuration exige Cloudinary en
    // production. Le garde reste au cas où cette règle changerait.
    throw new Error('Cloudinary est obligatoire en production');
  }

  return localStorage(env, logger);
}
