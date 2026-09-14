import { MemberShell } from "@/components/member/member-shell";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth/guards";
import { getActiveSubscription } from "@/server/services/access.service";
import { resolvePublicUrls } from "@/server/services/media.service";
import { getSiteConfig } from "@/server/services/settings.service";
import { maybeRunSubscriptionJob } from "@/server/services/subscription.service";

export const metadata = { robots: { index: false, follow: false } };

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  await maybeRunSubscriptionJob();
  const [site, sub, urls] = await Promise.all([getSiteConfig(), getActiveSubscription(user.id), resolvePublicUrls([user.avatarMediaId])]);
  return (
    <MemberShell
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarMediaId ? (urls.get(user.avatarMediaId) ?? null) : null }}
      siteName={site.identity.siteName}
      planName={sub?.plan.name ?? null}
      staff={can(user.role, "admin.access")}
    >
      {children}
    </MemberShell>
  );
}
