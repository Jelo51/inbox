import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Payment, PrismaClient, Receipt } from '@prisma/client';
import { formatPrice } from '@inbox/shared';
import { publisherIdentity, type PublisherIdentity } from '../../lib/publisher.js';

/**
 * Reçus d'abonnement.
 *
 * Deux exigences comptables commandent ce module :
 *   1. la numérotation est **continue et sans trou** par année — une séquence
 *      PostgreSQL en laisserait à chaque transaction annulée, d'où le calcul
 *      sous verrou d'avis (`inbox_next_receipt_sequence`) ;
 *   2. l'identité de l'éditeur est **figée à l'émission** — un reçu ne doit pas
 *      changer rétroactivement le jour où la société est immatriculée.
 */

export async function issueReceipt(
  prisma: PrismaClient,
  payment: Payment,
  now: Date,
): Promise<Receipt> {
  const existing = await prisma.receipt.findUnique({ where: { paymentId: payment.id } });
  if (existing) return existing;

  const year = now.getUTCFullYear();

  return prisma.$transaction(async (tx) => {
    // Prisma transmet un entier JavaScript en `bigint` : sans le transtypage,
    // PostgreSQL ne trouve pas la fonction, qui attend un `integer`.
    const rows = await tx.$queryRaw<{ sequence: number }[]>`
      SELECT inbox_next_receipt_sequence(${year}::int) AS sequence
    `;
    const sequence = rows[0]?.sequence;
    if (sequence === undefined) {
      throw new Error('Numérotation des reçus indisponible');
    }

    return tx.receipt.create({
      data: {
        paymentId: payment.id,
        number: `INB-${year}-${String(sequence).padStart(6, '0')}`,
        year,
        sequence,
        issuerSnapshot: publisherIdentity() as unknown as object,
        issuedAt: now,
      },
    });
  });
}

interface ReceiptContext {
  receipt: Receipt;
  payment: Payment;
  buyerName: string;
  buyerEmail: string;
  planName: string;
  periodStart: Date | null;
  periodEnd: Date | null;
}

const COLORS = {
  ink: rgb(0.09, 0.1, 0.12),
  muted: rgb(0.29, 0.32, 0.35),
  grey: rgb(0.49, 0.52, 0.55),
  orange: rgb(1, 0.43, 0.08),
  line: rgb(0.9, 0.9, 0.91),
};

/**
 * Les polices standard d'un PDF utilisent l'encodage WinAnsi, qui ne connaît ni
 * l'apostrophe typographique ni les guillemets français. Plutôt que d'embarquer
 * une police complète pour quelques caractères, on les ramène à leur équivalent
 * ASCII. Sans cela, `pdf-lib` lève « WinAnsi cannot encode » et le reçu échoue
 * à se générer — un mot de trop dans un libellé suffirait à casser la
 * facturation.
 */
const WINANSI_SUBSTITUTIONS: Record<string, string> = {
  '\u2019': "'",
  '\u2018': "'",
  '\u201C': '"',
  '\u201D': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2026': '...',
  '\u202F': ' ',
  '\u00A0': ' ',
  '\u2039': '<',
  '\u203A': '>',
};

export function toWinAnsi(text: string): string {
  return text.replace(
    /[\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u202F\u00A0\u2039\u203A]/g,
    (char) => WINANSI_SUBSTITUTIONS[char] ?? char,
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Africa/Douala' }).format(
    date,
  );
}

/** Lignes d'identité de l'éditeur, telles qu'elles étaient à l'émission. */
function issuerLines(issuer: PublisherIdentity): string[] {
  const lines = [issuer.name];

  if (issuer.legalForm) {
    lines.push(
      issuer.capital ? `${issuer.legalForm} au capital de ${issuer.capital}` : issuer.legalForm,
    );
  }
  lines.push(issuer.address);
  if (issuer.rccm) lines.push(`RCCM : ${issuer.rccm}`);
  if (issuer.niu) lines.push(`NIU : ${issuer.niu}`);
  lines.push(issuer.email);
  if (issuer.phone) lines.push(issuer.phone);

  return lines;
}

export async function renderReceiptPdf(context: ReceiptContext): Promise<Uint8Array> {
  const { receipt, payment } = context;
  const issuer = receipt.issuerSnapshot as unknown as PublisherIdentity;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Reçu ${receipt.number}`);
  pdf.setProducer('Inbox');
  pdf.setCreationDate(receipt.issuedAt);

  const page = pdf.addPage([595.28, 841.89]); // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 56;
  let y = 785;

  const write = (
    text: string,
    options: { size?: number; font?: typeof regular; color?: typeof COLORS.ink; x?: number } = {},
  ) => {
    page.drawText(toWinAnsi(text), {
      x: options.x ?? margin,
      y,
      size: options.size ?? 10,
      font: options.font ?? regular,
      color: options.color ?? COLORS.ink,
    });
  };

  // En-tête
  write('Inbox', { size: 22, font: bold, color: COLORS.orange });
  write('REÇU', { size: 22, font: bold, x: 440 });
  y -= 18;
  write(receipt.number, { size: 11, font: bold, x: 440, color: COLORS.muted });
  y -= 26;

  // Émetteur
  write('Émetteur', { size: 9, font: bold, color: COLORS.grey });
  y -= 14;
  for (const line of issuerLines(issuer)) {
    write(line, { size: 9, color: COLORS.muted });
    y -= 12;
  }

  // Destinataire
  y -= 10;
  write('Destinataire', { size: 9, font: bold, color: COLORS.grey });
  y -= 14;
  write(context.buyerName, { size: 10 });
  y -= 12;
  write(context.buyerEmail, { size: 9, color: COLORS.muted });
  y -= 26;

  page.drawLine({
    start: { x: margin, y },
    end: { x: 595.28 - margin, y },
    thickness: 1,
    color: COLORS.line,
  });
  y -= 24;

  // Détail
  write('Date d’émission', { size: 9, font: bold, color: COLORS.grey });
  write(formatDate(receipt.issuedAt), { size: 9, x: 200 });
  y -= 16;

  write('Référence du paiement', { size: 9, font: bold, color: COLORS.grey });
  write(payment.reference, { size: 9, x: 200 });
  y -= 16;

  write('Moyen de paiement', { size: 9, font: bold, color: COLORS.grey });
  const methodLabel = {
    MTN_MOMO: 'MTN Mobile Money',
    ORANGE_MONEY: 'Orange Money',
    CARD: 'Carte bancaire',
  }[payment.method];
  write(methodLabel, { size: 9, x: 200 });
  y -= 16;

  if (context.periodStart && context.periodEnd) {
    write('Période couverte', { size: 9, font: bold, color: COLORS.grey });
    write(`du ${formatDate(context.periodStart)} au ${formatDate(context.periodEnd)}`, {
      size: 9,
      x: 200,
    });
    y -= 16;
  }

  y -= 14;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 595.28 - margin, y },
    thickness: 1,
    color: COLORS.line,
  });
  y -= 24;

  // Montant
  write(context.planName, { size: 11, font: bold });
  write(formatPrice(payment.amountXaf), { size: 11, font: bold, x: 420 });
  y -= 18;

  if (payment.vatXaf > 0) {
    write('dont TVA', { size: 9, color: COLORS.muted });
    write(formatPrice(payment.vatXaf), { size: 9, color: COLORS.muted, x: 420 });
    y -= 14;
  }

  y -= 10;
  write('Total payé', { size: 12, font: bold });
  write(formatPrice(payment.amountXaf), { size: 12, font: bold, color: COLORS.orange, x: 420 });

  // Pied de page
  page.drawText(
    toWinAnsi(
      'Ce reçu atteste du paiement de l’abonnement Inbox Pro. Il ne constitue pas une facture fiscale.',
    ),
    { x: margin, y: 70, size: 8, font: regular, color: COLORS.grey },
  );
  page.drawText(toWinAnsi(`Émis le ${formatDate(receipt.issuedAt)} — ${receipt.number}`), {
    x: margin,
    y: 56,
    size: 8,
    font: regular,
    color: COLORS.grey,
  });

  return pdf.save();
}
