import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import { getCurrentUser } from "@/server/auth/session";
import { resolvePublicUrls } from "@/server/services/media.service";
import { getSiteConfig, isDemoMode } from "@/server/services/settings.service";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [site, user] = await Promise.all([getSiteConfig(), getCurrentUser()]);
  const urls = await resolvePublicUrls([site.identity.logoMediaId]);
  return (
    <div className="page-glow flex min-h-dvh flex-col">
      <SiteHeader site={site} user={user} logoUrl={site.identity.logoMediaId ? (urls.get(site.identity.logoMediaId) ?? null) : null} demo={isDemoMode()} />
      <main className="flex-1">{children}</main>
      <SiteFooter site={site} />
    </div>
  );
}
