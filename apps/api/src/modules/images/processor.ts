import sharp from 'sharp';
import { LISTING_LIMITS } from '@inbox/shared';
import { HttpError } from '../../lib/http-error.js';
import { detectImageFormat, looksLikeSvg, type ImageFormat } from './validation.js';

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  bytes: number;
  format: 'webp';
  originalFormat: ImageFormat;
}

/** Deux tailles suffisent : la vignette des listes et la vue de la fiche. */
export const IMAGE_VARIANTS = {
  full: { width: 1400, height: 1400, quality: 80 },
  thumb: { width: 480, height: 480, quality: 72 },
} as const;

export type ImageVariant = keyof typeof IMAGE_VARIANTS;

/**
 * Normalise une photo téléversée.
 *
 * Trois choses se passent ici, et la deuxième est la plus importante :
 *   1. le type réel est vérifié sur les octets, jamais sur l'extension ;
 *   2. **toutes les métadonnées sont supprimées** — une photo prise au domicile
 *      du vendeur porte ses coordonnées GPS, et les publier reviendrait à
 *      diffuser son adresse à son insu ;
 *   3. l'image est redimensionnée et convertie en WebP.
 *
 * `sharp` ne conserve les métadonnées que si on le lui demande explicitement
 * (`withMetadata()`), donc ne pas l'appeler suffit. Le test
 * `tests/unit/image-processor.test.ts` vérifie que c'est bien le cas, parce
 * qu'une régression ici serait silencieuse et grave.
 */
export async function processImage(
  input: Buffer,
  variant: ImageVariant = 'full',
): Promise<ProcessedImage> {
  if (input.length === 0) {
    throw HttpError.badRequest('EMPTY_FILE', 'Fichier vide');
  }

  if (input.length > LISTING_LIMITS.imageMaxBytes) {
    throw HttpError.badRequest(
      'FILE_TOO_LARGE',
      `Photo trop lourde : ${Math.round(LISTING_LIMITS.imageMaxBytes / 1024 / 1024)} Mo au maximum`,
    );
  }

  if (looksLikeSvg(input)) {
    throw HttpError.badRequest(
      'UNSUPPORTED_FORMAT',
      'Les fichiers SVG ne sont pas acceptés. Utilisez une photo au format JPEG, PNG ou WebP.',
    );
  }

  const originalFormat = detectImageFormat(input);
  if (!originalFormat) {
    throw HttpError.badRequest(
      'UNSUPPORTED_FORMAT',
      'Format non reconnu. Formats acceptés : JPEG, PNG, WebP.',
    );
  }

  const { width, height, quality } = IMAGE_VARIANTS[variant];

  try {
    const pipeline = sharp(input, {
      // Une « bombe de décompression » est une image minuscule qui se déplie en
      // plusieurs gigaoctets. On plafonne donc les pixels traités.
      limitInputPixels: 50_000_000,
      failOn: 'error',
    })
      // `rotate()` sans argument applique l'orientation EXIF puis l'oublie :
      // sans cela, retirer les métadonnées coucherait les photos de portrait.
      .rotate()
      .resize({ width, height, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      data,
      width: info.width,
      height: info.height,
      bytes: info.size,
      format: 'webp',
      originalFormat,
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw HttpError.badRequest('IMAGE_UNREADABLE', 'Cette image n’a pas pu être lue');
  }
}

/** Métadonnées restantes d'une image traitée, pour le test de non-régression. */
export async function readMetadata(buffer: Buffer) {
  const meta = await sharp(buffer).metadata();
  return {
    format: meta.format,
    width: meta.width,
    height: meta.height,
    hasExif: meta.exif !== undefined,
    hasIcc: meta.icc !== undefined,
    hasXmp: meta.xmp !== undefined,
    hasIptc: meta.iptc !== undefined,
    orientation: meta.orientation,
  };
}
