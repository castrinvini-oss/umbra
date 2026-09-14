import { PageHeader } from "@/components/ui/primitives";
import { SecuritySettings } from "@/components/account/security-settings";
import { requireUser } from "@/server/auth/guards";
import { listNotifications } from "@/server/services/notification.service";
import { NotificationList } from "@/components/account/notification-list";

export const metadata = { title: "Configurações" };

export default async function MemberSettingsPage() {
  const user = await requireUser("/configuracoes");
  const notifications = await listNotifications({ staff: false, userId: user.id }, 15);
  return (
    <>
      <PageHeader eyebrow="Conta" title="Configurações" />
      <div className="grid gap-6 lg:grid-cols-2">
        <SecuritySettings twoFactorEnabled={user.twoFactorEnabled} />
        <NotificationList items={notifications.items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString(), readAt: n.readAt?.toISOString() ?? null }))} scope="me" />
      </div>
    </>
  );
}
