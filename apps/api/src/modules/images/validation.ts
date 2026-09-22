/**
 * Validation du type réel d'une image par ses octets d'en-tête.
 *
 * L'extension du fichier et l'en-tête `Content-Type` sont fournis par le
 * client : les croire reviendrait à laisser n'importe qui téléverser un script
 * baptisé « photo.jpg ». Seuls les premiers octets font foi.
 */

export type ImageFormat = 'jpeg' | 'png' | 'webp';

interface Signature {
  format: ImageFormat;
  offset: number;
  bytes: number[];
  /** Contrôle complémentaire, quand la signature initiale ne suffit pas. */
  extra?: (buffer: Buffer) => boolean;
}

const SIGNATURES: Signature[] = [
  { format: 'jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { format: 'png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  {
    // RIFF....WEBP : la signature est coupée en deux par la taille du fichier.
    format: 'webp',
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46],
    extra: (buffer) => buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export function detectImageFormat(buffer: Buffer): ImageFormat | null {
  for (const signature of SIGNATURES) {
    const slice = buffer.subarray(signature.offset, signature.offset + signature.bytes.length);
    if (slice.length !== signature.bytes.length) continue;
    if (!signature.bytes.every((byte, index) => slice[index] === byte)) continue;
    if (signature.extra && !signature.extra(buffer)) continue;
    return signature.format;
  }
  return null;
}

/**
 * Une image SVG peut embarquer du script : elle n'a rien à faire dans une
 * photo d'annonce, et on la refuse explicitement plutôt que de la laisser
 * échouer plus loin avec un message obscur.
 */
export function looksLikeSvg(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 1024).toString('utf8').trimStart().toLowerCase();
  return head.startsWith('<?xml') || head.startsWith('<svg');
}
