import { db } from "../db";

export const NOTIFICATION_TYPES = {
  NEW_SIGNUP: "Novo cadastro",
  PAYMENT_APPROVED: "Pagamento aprovado",
  PAYMENT_FAILED: "Pagamento recusado",
  NEW_SUBSCRIPTION: "Nova assinatura",
  CANCELLATION: "Cancelamento",
  RENEWAL: "Renovação",
  NEW_REPORT: "Nova denúncia",
  REFUND: "Reembolso",
  SYSTEM: "Sistema",
} as const;
export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export async function notifyStaff(type: NotificationType, title: string, body = "", link?: string) {
  await db.notification.create({ data: { audience: "STAFF", type, title, body, link } }).catch(() => {});
}

export async function notifyUser(userId: string, type: NotificationType, title: string, body = "", link?: string) {
  await db.notification.create({ data: { audience: "USER", userId, type, title, body, link } }).catch(() => {});
}

export async function listNotifications(scope: { staff: boolean; userId: string }, limit = 20) {
  const where = scope.staff ? { audience: "STAFF" } : { audience: "USER", userId: scope.userId };
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
    db.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markAllRead(scope: { staff: boolean; userId: string }) {
  const where = scope.staff ? { audience: "STAFF" } : { audience: "USER", userId: scope.userId };
  await db.notification.updateMany({ where: { ...where, readAt: null }, data: { readAt: new Date() } });
}
