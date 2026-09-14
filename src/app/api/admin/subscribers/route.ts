import { apiRoute } from "@/server/http/api";
import { listSubscribers } from "@/server/services/admin-queries.service";

export const GET = apiRoute({ auth: "subscribers.view" }, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  return { subscribers: await listSubscribers({ status: sp.get("status"), q: sp.get("q"), planId: sp.get("plan") }) };
});
