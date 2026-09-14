import { subscriberActionSchema } from "@/lib/validators";
import { destroyAllSessions } from "@/server/auth/session";
import { db } from "@/server/db";
import { apiRoute, badRequest, forbidden, notFound } from "@/server/http/api";
import { getActiveSubscription } from "@/server/services/access.service";
import { getSubscriberDetail } from "@/server/services/admin-queries.service";
import { logAdmin } from "@/server/services/audit.service";
import { cancelSubscription, changePlan, grantAccess } from "@/server/services/subscription.service";
import { can } from "@/lib/permissions";

export const GET = apiRoute({ auth: "subscribers.view" }, async ({ params }) => {
  const subscriber = await getSubscriberDetail(params.id!);
  if (!subscriber) throw notFound("Assinante não encontrado");
  return { subscriber };
});

/** Ações: bloquear, desbloquear, cancelar, alterar plano, conceder acesso. */
export const POST = apiRoute({ auth: "subscribers.view", schema: subscriberActionSchema }, async ({ params, body, user, ip }) => {
  if (!can(user.role, "subscribers.manage")) throw forbidden();
  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target) throw notFound("Assinante não encontrado");
  if (target.role !== "SUBSCRIBER") throw badRequest("Ação disponível apenas para assinantes");

  switch (body.action) {
    case "block":
      await db.user.update({ where: { id: target.id }, data: { status: "BLOCKED", blockedReason: body.reason ?? null } });
      await destroyAllSessions(target.id);
      break;
    case "unblock":
      await db.user.update({ where: { id: target.id }, data: { status: "ACTIVE", blockedReason: null } });
      break;
    case "cancel": {
      const sub = await getActiveSubscription(target.id);
      if (!sub) throw badRequest("Sem assinatura ativa");
      await cancelSubscription(sub.id, { immediate: body.immediate, by: "admin", reason: "Cancelada pelo administrador" });
      break;
    }
    case "changePlan": {
      const sub = await getActiveSubscription(target.id);
      if (!sub) throw badRequest("Sem assinatura ativa — use 'Conceder acesso'");
      await changePlan(sub.id, body.planId);
      break;
    }
    case "grant":
      await grantAccess(target.id, body.planId, body.months);
      break;
  }
  await logAdmin({ actorId: user.id, action: `subscriber.${body.action}`, entityType: "user", entityId: target.id, ip, metadata: body });
  return { ok: true };
});
