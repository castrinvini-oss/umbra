import { can } from "@/lib/permissions";
import { planSchema } from "@/lib/validators";
import { apiRoute } from "@/server/http/api";
import { logAdmin } from "@/server/services/audit.service";
import { createPlan, listPlans, listPlansWithStats } from "@/server/services/plan.service";

export const GET = apiRoute({ auth: "public" }, async ({ user, req }) => {
  if (req.nextUrl.searchParams.get("all") === "1" && can(user?.role, "plans.manage")) {
    return { plans: await listPlansWithStats() };
  }
  return { plans: await listPlans({ activeOnly: true }) };
});

export const POST = apiRoute({ auth: "plans.manage", schema: planSchema }, async ({ body, user, ip }) => {
  const plan = await createPlan(body);
  await logAdmin({ actorId: user.id, action: "plan.create", entityType: "plan", entityId: plan.id, ip, metadata: { name: plan.name } });
  return { plan };
});
