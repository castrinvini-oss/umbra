import { requirePermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { EMAIL_TEMPLATE_LABELS } from "@/server/email/templates";
import { env } from "@/server/env";
import { listAdminLogs, listTeam } from "@/server/services/admin-queries.service";
import { getPaymentConfigMasked } from "@/server/services/settings.service";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Configurações" };

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("settings.manage");
  const [{ tab }, payment, team, logs, emails] = await Promise.all([
    searchParams,
    getPaymentConfigMasked(),
    listTeam(),
    listAdminLogs(200),
    db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  return (
    <SettingsView
      initialTab={tab ?? "pagamentos"}
      payment={payment}
      webhookUrl={`${env.appUrl}/api/payment/webhook`}
      team={JSON.parse(JSON.stringify(team))}
      logs={logs}
      emails={JSON.parse(JSON.stringify(emails))}
      templates={Object.entries(EMAIL_TEMPLATE_LABELS).map(([id, label]) => ({ id, label }))}
      twoFactorEnabled={user.twoFactorEnabled}
      system={{
        demoMode: env.demoMode,
        appUrl: env.appUrl,
        storage: env.storage.driver,
        emailDriver: env.email.driver,
        maxImageMb: Math.round(env.storage.maxImageBytes / 1024 / 1024),
        maxVideoMb: Math.round(env.storage.maxVideoBytes / 1024 / 1024),
        database: (process.env.DATABASE_URL ?? "").startsWith("file:") ? "SQLite" : "PostgreSQL",
        cronConfigured: !!env.cronSecret,
      }}
    />
  );
}
