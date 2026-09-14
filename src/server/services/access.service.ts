import type { Plan, Subscription } from "@prisma/client";
import { STAFF_ROLES, type Role } from "@/lib/constants";
import { parseJson } from "@/lib/utils";
import { db } from "../db";

export type ActiveSubscription = Subscription & { plan: Plan };

export type AccessReason =
  | "free" // conteúdo sem plano mínimo
  | "staff" // equipe (admin/creator/moderador)
  | "plan" // assinatura válida e compatível
  | "login_required"
  | "no_subscription"
  | "plan_too_low"
  | "category_not_included"
  | "unavailable"; // removido, rascunho ou agendado

export type AccessDecision = { allowed: boolean; reason: AccessReason };

/** Assinatura que efetivamente dá acesso agora (status válido E período vigente). */
export async function getActiveSubscription(userId: string): Promise<ActiveSubscription | null> {
  return db.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { gt: new Date() } },
    include: { plan: true },
    orderBy: [{ plan: { level: "desc" } }, { currentPeriodEnd: "desc" }],
  });
}

type ContentForAccess = {
  status: string;
  publishedAt: Date | null;
  categoryId: string | null;
  requiredPlan: { level: number } | null;
};

/** Regra pura (sem I/O) — usada em lote na montagem do feed. */
export function evaluateAccess(
  user: { role: string } | null,
  subscription: ActiveSubscription | null,
  content: ContentForAccess,
): AccessDecision {
  const isStaff = !!user && STAFF_ROLES.includes(user.role as Role);
  const live = content.status === "PUBLISHED" && (!content.publishedAt || content.publishedAt <= new Date());
  if (!live) return isStaff ? { allowed: true, reason: "staff" } : { allowed: false, reason: "unavailable" };
  if (isStaff) return { allowed: true, reason: "staff" };
  if (!content.requiredPlan) return { allowed: true, reason: "free" };
  if (!user) return { allowed: false, reason: "login_required" };
  if (!subscription) return { allowed: false, reason: "no_subscription" };
  if (subscription.plan.level < content.requiredPlan.level) return { allowed: false, reason: "plan_too_low" };
  const categories = parseJson<string[]>(subscription.plan.categoryIds, []);
  if (categories.length && content.categoryId && !categories.includes(content.categoryId)) {
    return { allowed: false, reason: "category_not_included" };
  }
  return { allowed: true, reason: "plan" };
}

/**
 * Ponto único de autorização de conteúdo premium. Verifica: usuário
 * autenticado e ativo, assinatura válida, plano compatível, conteúdo ativo.
 */
export async function canAccessContent(userId: string | null, contentId: string): Promise<AccessDecision> {
  const [user, content] = await Promise.all([
    userId ? db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } }) : null,
    db.content.findUnique({
      where: { id: contentId },
      select: { status: true, publishedAt: true, categoryId: true, requiredPlan: { select: { level: true } } },
    }),
  ]);
  if (!content) return { allowed: false, reason: "unavailable" };
  if (user && user.status !== "ACTIVE") return { allowed: false, reason: "login_required" };
  const subscription = user ? await getActiveSubscription(user.id) : null;
  return evaluateAccess(user, subscription, content);
}

/** Uma mídia privada é liberada se o usuário puder acessar algum conteúdo que a utiliza. */
export async function canAccessMedia(user: { id: string; role: string; avatarMediaId?: string | null } | null, mediaId: string) {
  const media = await db.media.findUnique({
    where: { id: mediaId },
    select: { visibility: true, status: true, uploaderId: true, contents: { select: { contentId: true } } },
  });
  if (!media || media.status !== "READY") return false;
  if (media.visibility === "PUBLIC") return true;
  if (user && STAFF_ROLES.includes(user.role as Role)) return true;
  if (user && (media.uploaderId === user.id || user.avatarMediaId === mediaId)) return true;

  // Visitantes anônimos só alcançam mídia de publicações gratuitas.
  const contentIds = media.contents.map((c) => c.contentId);
  const covers = await db.content.findMany({ where: { coverMediaId: mediaId }, select: { id: true } });
  contentIds.push(...covers.map((c) => c.id));
  for (const id of new Set(contentIds)) {
    if ((await canAccessContent(user?.id ?? null, id)).allowed) return true;
  }
  return false;
}
