import { apiRoute } from "@/server/http/api";
import { getDashboardAnalytics, getReports } from "@/server/services/analytics.service";

export const GET = apiRoute({ auth: "dashboard.view" }, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  if (sp.get("type") === "reports") return getReports();
  return getDashboardAnalytics(sp.get("range") ?? undefined, sp.get("from") ?? undefined, sp.get("to") ?? undefined);
});
