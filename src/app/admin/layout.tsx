import { AdminShell } from "@/components/admin/admin-shell";
import { requirePermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSiteConfig, isDemoMode } from "@/server/services/settings.service";
import { maybeRunSubscriptionJob } from "@/server/services/subscription.service";

export const metadata = { title: { default: "Painel", template: "%s · Painel" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission("admin.access", "/admin/dashboard");
  await maybeRunSubscriptionJob();
  const [site, openReports] = await Promise.all([getSiteConfig(), db.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } })]);
  return (
    <AdminShell user={{ name: user.name, email: user.email, role: user.role }} siteName={site.identity.siteName} openReports={openReports} demo={isDemoMode()}>
      {children}
    </AdminShell>
  );
}
