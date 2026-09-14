import { requirePermission } from "@/server/auth/guards";
import { listLeads } from "@/server/services/admin-queries.service";
import { getCrmStats } from "@/server/services/analytics.service";
import { CrmView } from "./crm-view";

export const metadata = { title: "CRM" };

export default async function LeadsPage() {
  await requirePermission("leads.manage");
  const [leads, stats] = await Promise.all([listLeads({}), getCrmStats()]);
  return <CrmView leads={leads} stats={stats} />;
}
