import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processImage, readMetadata } from '../../src/modules/images/processor.js';
import { detectImageFormat, looksLikeSvg } from '../../src/modules/images/validation.js';

/**
 * Une photo prise au domicile du vendeur porte ses coordonnées GPS. Les
 * publier telles quelles reviendrait à diffuser son adresse à son insu, et la
 * régression serait invisible à l'œil nu — d'où ces tests.
 */

/** Photo JPEG avec des métadonnées EXIF, dont une position GPS. */
async function jpegWithExif(): Promise<Buffer> {
  return sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .withExif({
      IFD0: { Copyright: 'Inbox', Make: 'Essai', Model: 'Appareil de test' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '4/1 3/1 27/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '9/1 42/1 58/1',
      },
    })
    .jpeg()
    .toBuffer();
}

describe('détection du type réel', () => {
  it('reconnaît le JPEG, le PNG et le WebP à leurs octets d’en-tête', async () => {
    const base = sharp({
      create: { width: 32, height: 32, channels: 3, background: '#FF6E14' },
    });

    expect(detectImageFormat(await base.clone().jpeg().toBuffer())).toBe('jpeg');
    expect(detectImageFormat(await base.clone().png().toBuffer())).toBe('png');
    expect(detectImageFormat(await base.clone().webp().toBuffer())).toBe('webp');
  });

  it('ne se laisse pas tromper par une extension mensongère', () => {
    // Un script renommé « photo.jpg » : l'extension dit JPEG, les octets non.
    const fichier = Buffer.from('#!/bin/sh\necho compromis\n', 'utf8');
    expect(detectImageFormat(fichier)).toBeNull();
  });

  it('repère un SVG, qui peut embarquer du script', () => {
    expect(looksLikeSvg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(true);
    expect(looksLikeSvg(Buffer.from('<?xml version="1.0"?><svg></svg>'))).toBe(true);
  });
});

describe('traitement d’une photo', () => {
  it('retire toutes les métadonnées, EXIF et GPS compris', async () => {
    const original = await jpegWithExif();

    // L'image de départ porte bien des métadonnées : sans cela le test ne
    // prouverait rien.
    expect((await readMetadata(original)).hasExif).toBe(true);

    const processed = await processImage(original);
    const meta = await readMetadata(processed.data);

    expect(meta.hasExif).toBe(false);
    expect(meta.hasXmp).toBe(false);
    expect(meta.hasIptc).toBe(false);
  });

  it('convertit en WebP et redimensionne sans agrandir', async () => {
    const grande = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#171A1F' },
    })
      .jpeg()
      .toBuffer();

    const processed = await processImage(grande, 'full');
    expect(processed.format).toBe('webp');
    expect(processed.width).toBeLessThanOrEqual(1400);
    expect(processed.height).toBeLessThanOrEqual(1400);

    const petite = await sharp({
      create: { width: 200, height: 150, channels: 3, background: '#171A1F' },
    })
      .png()
      .toBuffer();

    const inchangee = await processImage(petite, 'full');
    expect(inchangee.width).toBe(200);
    expect(inchangee.height).toBe(150);
  });

  it('applique l’orientation EXIF avant de la jeter', async () => {
    // Orientation 6 : l'appareil a photographié en portrait. En retirant l'EXIF
    // sans appliquer la rotation, l'image ressortirait couchée.
    const couchee = await sharp({
      create: { width: 400, height: 200, channels: 3, background: '#FF6E14' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const processed = await processImage(couchee);
    expect(processed.width).toBe(200);
    expect(processed.height).toBe(400);
  });

  it('refuse un fichier qui n’est pas une image', async () => {
    await expect(processImage(Buffer.from('ceci est du texte'))).rejects.toMatchObject({
      code: 'UNSUPPORTED_FORMAT',
    });
  });

  it('refuse un SVG', async () => {
    await expect(processImage(Buffer.from('<svg xmlns="x"><script/></svg>'))).rejects.toMatchObject(
      {
        code: 'UNSUPPORTED_FORMAT',
      },
    );
  });

  it('refuse un fichier vide', async () => {
    await expect(processImage(Buffer.alloc(0))).rejects.toMatchObject({ code: 'EMPTY_FILE' });
  });

  it('refuse un fichier au-delà de la limite de taille', async () => {
    const trop = Buffer.alloc(9 * 1024 * 1024);
    // En-tête JPEG valide, pour que le refus vienne bien de la taille.
    trop.set([0xff, 0xd8, 0xff], 0);
    await expect(processImage(trop)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });
});
