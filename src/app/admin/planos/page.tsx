import { requirePermission } from "@/server/auth/guards";
import { listCategories } from "@/server/services/content.service";
import { listPlansWithStats } from "@/server/services/plan.service";
import { PlansManager } from "./plans-manager";

export const metadata = { title: "Planos" };

export default async function AdminPlansPage() {
  await requirePermission("plans.manage");
  const [plans, categories] = await Promise.all([listPlansWithStats(), listCategories()]);
  return <PlansManager plans={plans} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />;
}
