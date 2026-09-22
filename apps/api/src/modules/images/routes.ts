import { Router } from 'express';
import multer from 'multer';
import type { PrismaClient } from '@prisma/client';
import { LISTING_LIMITS } from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import { now } from '../../lib/clock.js';
import { requireAuth, requireVerifiedEmail } from '../../middleware/auth.js';
import { processImage } from './processor.js';
import type { ImageStorage } from './storage.js';

/**
 * Le fichier est gardé en mémoire : il ne dépasse jamais 8 Mo, et l'écrire sur
 * disque avant d'en avoir vérifié le type reviendrait à déposer un fichier
 * inconnu sur le serveur.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LISTING_LIMITS.imageMaxBytes, files: 1 },
});

export function imageRouter(prisma: PrismaClient, storage: ImageStorage): Router {
  const router = Router();

  router.post(
    '/images',
    requireAuth(prisma),
    requireVerifiedEmail,
    upload.single('file'),
    (req, res, next) => {
      void (async () => {
        try {
          if (!req.file) throw HttpError.badRequest('NO_FILE', 'Aucun fichier reçu');

          const processed = await processImage(req.file.buffer, 'full');
          const stored = await storage.upload(processed.data, {
            width: processed.width,
            height: processed.height,
            bytes: processed.bytes,
            format: processed.format,
          });

          const image = await prisma.listingImage.create({
            data: {
              publicId: stored.publicId,
              width: stored.width,
              height: stored.height,
              bytes: stored.bytes,
              format: stored.format,
              uploadedById: req.auth!.userId,
              createdAt: now(),
            },
          });

          res.status(201).json({
            image: {
              id: image.id,
              url: storage.url(image.publicId, 'full'),
              thumbUrl: storage.url(image.publicId, 'thumb'),
              width: image.width,
              height: image.height,
            },
          });
        } catch (err) {
          next(err);
        }
      })();
    },
  );

  router.delete('/images/:id', requireAuth(prisma), (req, res, next) => {
    void (async () => {
      try {
        const image = await prisma.listingImage.findUnique({ where: { id: req.params.id } });
        if (!image) throw HttpError.notFound();
        if (image.uploadedById !== req.auth!.userId) throw HttpError.forbidden();

        await storage.remove(image.publicId);
        await prisma.listingImage.delete({ where: { id: image.id } });
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}

/** Traduit les erreurs de multer dans la forme d'erreur de l'API. */
export function multerErrorHandler(
  err: unknown,
  _req: unknown,
  _res: unknown,
  next: (e?: unknown) => void,
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(
        HttpError.badRequest(
          'FILE_TOO_LARGE',
          `Photo trop lourde : ${Math.round(LISTING_LIMITS.imageMaxBytes / 1024 / 1024)} Mo au maximum`,
        ),
      );
    }
    return next(HttpError.badRequest('UPLOAD_ERROR', 'Téléversement refusé'));
  }
  next(err);
}
