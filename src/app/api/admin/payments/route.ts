import { apiRoute } from "@/server/http/api";
import { listPayments, listWebhookEvents } from "@/server/services/admin-queries.service";

export const GET = apiRoute({ auth: "payments.view" }, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const [payments, webhooks] = await Promise.all([
    listPayments({ status: sp.get("status"), method: sp.get("method"), q: sp.get("q") }),
    listWebhookEvents(),
  ]);
  return { payments, webhooks };
});
