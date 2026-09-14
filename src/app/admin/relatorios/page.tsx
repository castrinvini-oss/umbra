import { requirePermission } from "@/server/auth/guards";
import { getReports } from "@/server/services/analytics.service";
import { ReportsView } from "./reports-view";

export const metadata = { title: "Relatórios" };

export default async function AdminReportsPage() {
  await requirePermission("reports.view");
  const data = await getReports();
  return <ReportsView data={data} />;
}
