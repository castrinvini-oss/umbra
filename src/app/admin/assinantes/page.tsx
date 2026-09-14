import { can } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/guards";
import { listSubscribers } from "@/server/services/admin-queries.service";
import { listPlans } from "@/server/services/plan.service";
import { SubscribersView } from "./subscribers-view";

export const metadata = { title: "Assinantes" };

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const user = await requirePermission("subscribers.view");
  const [subscribers, plans, sp] = await Promise.all([listSubscribers({}), listPlans(), searchParams]);
  return (
    <SubscribersView
      subscribers={subscribers}
      plans={plans.map((p) => ({ id: p.id, name: p.name }))}
      canManage={can(user.role, "subscribers.manage")}
      initialOpen={sp.u ?? null}
    />
  );
}
