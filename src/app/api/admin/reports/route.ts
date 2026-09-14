import { apiRoute } from "@/server/http/api";
import { listReports } from "@/server/services/report.service";

/** Denúncias (moderação). */
export const GET = apiRoute({ auth: "moderation.manage" }, async ({ req }) => ({
  reports: await listReports(req.nextUrl.searchParams.get("status") ?? undefined),
}));
