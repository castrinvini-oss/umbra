import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/constants";
import { db } from "../db";
import { HttpError } from "../http/api";
import { destroyAllSessions } from "../auth/session";
import { logAdmin } from "./audit.service";
import { notifyStaff } from "./notification.service";

export async function createReport(input: {
  contentId?: string;
  reason: ReportReason;
  details: string;
  reporterId?: string | null;
  reporterEmail?: string | null;
}) {
  let reportedUserId: string | null = null;
  if (input.contentId) {
    const content = await db.content.findUnique({ where: { id: input.contentId }, include: { profile: true } });
    if (!content) throw new HttpError(404, "Conteúdo não encontrado");
    reportedUserId = content.profile.userId;
  }
  const report = await db.report.create({
    data: {
      contentId: input.contentId,
      reason: input.reason,
      details: input.details,
      reporterId: input.reporterId ?? null,
      reporterEmail: input.reporterEmail || null,
      reportedUserId,
    },
  });
  const urgent = input.reason === "UNDERAGE" || input.reason === "ILLEGAL";
  await notifyStaff("NEW_REPORT", `${urgent ? "⚠ URGENTE — " : ""}Nova denúncia`, REPORT_REASON_LABELS[input.reason], "/admin/denuncias");
  return report;
}

export async function listReports(status?: string) {
  return db.report.findMany({
    where: status ? { status } : {},
    include: {
      content: { select: { id: true, title: true, status: true, type: true } },
      reporter: { select: { id: true, name: true, email: true } },
      reportedUser: { select: { id: true, name: true, email: true, status: true } },
      resolvedBy: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function actOnReport(
  id: string,
  action: { status?: string; resolution?: string; removeContent?: boolean; suspendUser?: boolean },
  actor: { id: string; ip?: string },
) {
  const report = await db.report.findUnique({ where: { id } });
  if (!report) throw new HttpError(404, "Denúncia não encontrada");

  if (action.removeContent && report.contentId) {
    await db.content.update({
      where: { id: report.contentId },
      data: { status: "REMOVED", removedReason: action.resolution || REPORT_REASON_LABELS[report.reason as ReportReason] },
    });
    await logAdmin({ actorId: actor.id, action: "content.remove", entityType: "content", entityId: report.contentId, ip: actor.ip, metadata: { reportId: id } });
  }

  if (action.suspendUser) {
    const target = report.reportedUserId ?? null;
    if (!target) throw new HttpError(400, "Esta denúncia não está associada a uma conta");
    if (target === actor.id) throw new HttpError(400, "Você não pode suspender a própria conta");
    await db.user.update({ where: { id: target }, data: { status: "SUSPENDED", blockedReason: action.resolution ?? "Denúncia procedente" } });
    await destroyAllSessions(target);
    await logAdmin({ actorId: actor.id, action: "user.suspend", entityType: "user", entityId: target, ip: actor.ip, metadata: { reportId: id } });
  }

  const finalStatus = action.status ?? (action.removeContent || action.suspendUser ? "RESOLVED" : report.status);
  const done = finalStatus === "RESOLVED" || finalStatus === "DISMISSED";
  const updated = await db.report.update({
    where: { id },
    data: {
      status: finalStatus,
      resolution: action.resolution ?? report.resolution,
      resolvedById: done ? actor.id : report.resolvedById,
      resolvedAt: done ? new Date() : report.resolvedAt,
    },
  });
  await logAdmin({ actorId: actor.id, action: "report.update", entityType: "report", entityId: id, ip: actor.ip, metadata: action });
  return updated;
}
