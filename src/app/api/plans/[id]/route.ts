import { planSchema } from "@/lib/validators";
import { apiRoute } from "@/server/http/api";
import { logAdmin } from "@/server/services/audit.service";
import { deletePlan, updatePlan } from "@/server/services/plan.service";

export const PUT = apiRoute({ auth: "plans.manage", schema: planSchema }, async ({ body, params, user, ip }) => {
  const plan = await updatePlan(params.id!, body);
  await logAdmin({ actorId: user.id, action: "plan.update", entityType: "plan", entityId: plan.id, ip, metadata: { priceCents: plan.priceCents, active: plan.active } });
  return { plan };
});

export const DELETE = apiRoute({ auth: "plans.manage" }, async ({ params, user, ip }) => {
  await deletePlan(params.id!);
  await logAdmin({ actorId: user.id, action: "plan.delete", entityType: "plan", entityId: params.id, ip });
  return { ok: true };
});
