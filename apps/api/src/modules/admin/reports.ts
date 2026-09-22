import type { PrismaClient, ReportStatus, ReportTarget } from '@prisma/client';
import { HttpError } from '../../lib/http-error.js';
import { recordAudit } from './audit.js';

export interface ReportQuery {
  status?: ReportStatus | undefined;
  target?: ReportTarget | undefined;
  cursor?: string | undefined;
  limit: number;
}

/**
 * Liste des signalements pour la modération.
 *
 * Les signalements d'annonces et d'utilisateurs portent une référence ; ceux
 * de conversations portent en plus les messages que l'utilisateur a choisi de
 * déchiffrer et de transmettre. Ces messages ne sont chargés qu'au détail,
 * pas dans la liste : les afficher en survol banaliserait leur lecture.
 */
export async function listReports(prisma: PrismaClient, query: ReportQuery) {
  const rows = await prisma.report.findMany({
    where: {
      ...(query.status && { status: query.status }),
      ...(query.target && { target: query.target }),
      ...(query.cursor && { createdAt: { lt: new Date(query.cursor) } }),
    },
    include: {
      author: { select: { id: true, displayName: true } },
      reportedUser: { select: { id: true, displayName: true, status: true } },
      _count: { select: { disclosedMessages: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    items: page.map((report) => ({
      id: report.id,
      target: report.target,
      targetId: report.targetId,
      reason: report.reason,
      comment: report.comment,
      status: report.status,
      createdAt: report.createdAt,
      handledAt: report.handledAt,
      author: report.author,
      reportedUser: report.reportedUser,
      disclosedMessageCount: report._count.disclosedMessages,
      hasDisclosureConsent: report.disclosureConsentAt !== null,
    })),
    nextCursor: hasMore ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
  };
}

/** Détail d'un signalement, messages transmis compris s'il y en a. */
export async function reportDetail(prisma: PrismaClient, reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      author: { select: { id: true, displayName: true, email: true } },
      reportedUser: { select: { id: true, displayName: true, email: true, status: true } },
      disclosedMessages: { orderBy: { sentAt: 'asc' } },
    },
  });

  if (!report) throw HttpError.notFound('REPORT_NOT_FOUND', 'Signalement introuvable');

  // Cible du signalement, pour que le modérateur voie de quoi il s'agit sans
  // avoir à chercher.
  const listing =
    report.target === 'LISTING'
      ? await prisma.listing.findUnique({
          where: { id: report.targetId },
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            price: true,
            status: true,
            sellerId: true,
            seller: { select: { id: true, displayName: true, email: true } },
          },
        })
      : null;

  return {
    id: report.id,
    target: report.target,
    targetId: report.targetId,
    reason: report.reason,
    comment: report.comment,
    status: report.status,
    createdAt: report.createdAt,
    handledAt: report.handledAt,
    handlerNote: report.handlerNote,
    author: report.author,
    reportedUser: report.reportedUser,
    listing,
    /**
     * Seul endroit du système où du texte de conversation apparaît en clair,
     * et il n'y arrive que par un acte délibéré de l'utilisateur, horodaté.
     */
    disclosureConsentAt: report.disclosureConsentAt,
    disclosedMessages: report.disclosedMessages.map((message) => ({
      id: message.id,
      sentAt: message.sentAt,
      fromReporter: message.fromReporter,
      plaintext: message.plaintext,
    })),
  };
}

export async function resolveReport(
  prisma: PrismaClient,
  reportId: string,
  moderatorId: string,
  status: 'RESOLVED' | 'DISMISSED',
  note: string | undefined,
  now: Date,
  ip?: string,
) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw HttpError.notFound('REPORT_NOT_FOUND', 'Signalement introuvable');

  if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
    throw HttpError.conflict('ALREADY_HANDLED', 'Ce signalement a déjà été traité');
  }

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: { status, handledById: moderatorId, handledAt: now, handlerNote: note ?? null },
  });

  await recordAudit(
    prisma,
    {
      actorId: moderatorId,
      action: status === 'RESOLVED' ? 'REPORT_RESOLVED' : 'REPORT_DISMISSED',
      targetType: 'Report',
      targetId: reportId,
      reason: note,
      metadata: { target: report.target, targetId: report.targetId, reason: report.reason },
      ip,
    },
    now,
  );

  return updated;
}

/** Passage en cours d'examen, pour que deux modérateurs ne se marchent pas dessus. */
export async function claimReport(prisma: PrismaClient, reportId: string, moderatorId: string) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw HttpError.notFound('REPORT_NOT_FOUND', 'Signalement introuvable');
  if (report.status !== 'OPEN') return report;

  return prisma.report.update({
    where: { id: reportId },
    data: { status: 'IN_REVIEW', handledById: moderatorId },
  });
}
