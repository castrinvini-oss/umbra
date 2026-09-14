import { apiRoute } from "@/server/http/api";
import { listLeads } from "@/server/services/admin-queries.service";
import { getCrmStats } from "@/server/services/analytics.service";

export const GET = apiRoute({ auth: "leads.manage" }, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const [leads, stats] = await Promise.all([listLeads({ stage: sp.get("stage"), q: sp.get("q") }), getCrmStats()]);
  return { leads, stats };
});
