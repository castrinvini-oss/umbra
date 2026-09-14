import { can } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/guards";
import { listPayments, listWebhookEvents } from "@/server/services/admin-queries.service";
import { getPaymentConfig, isDemoMode } from "@/server/services/settings.service";
import { PaymentsView } from "./payments-view";

export const metadata = { title: "Pagamentos" };

export default async function AdminPaymentsPage() {
  const user = await requirePermission("payments.view");
  const [payments, webhooks, config] = await Promise.all([listPayments({}), listWebhookEvents(40), getPaymentConfig()]);
  return (
    <PaymentsView
      payments={payments}
      webhooks={webhooks.map((w) => ({ ...w, createdAt: w.createdAt.toISOString(), processedAt: w.processedAt?.toISOString() ?? null }))}
      gateway={config.gateway}
      mode={config.mode}
      demo={isDemoMode() && config.gateway === "mock"}
      canManage={can(user.role, "payments.manage")}
    />
  );
}
