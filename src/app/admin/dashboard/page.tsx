import { requirePermission } from "@/server/auth/guards";
import { getDashboardAnalytics } from "@/server/services/analytics.service";
import { DashboardView } from "./dashboard-view";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ negado?: string }> }) {
  const user = await requirePermission("dashboard.view");
  const sp = await searchParams;
  const initial = await getDashboardAnalytics("30d");
  return <DashboardView initial={JSON.parse(JSON.stringify(initial))} userName={user.name.split(" ")[0]!} denied={sp.negado === "1"} />;
}
