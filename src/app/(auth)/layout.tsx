import Link from "next/link";
import { LogoMark } from "@/components/ui/primitives";
import { getPublicProfile } from "@/server/services/profile.service";
import { getSiteConfig } from "@/server/services/settings.service";

export const metadata = { robots: { index: false } };

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [site, profile] = await Promise.all([getSiteConfig(), getPublicProfile()]);
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden border-r border-line/60 lg:block">
        {profile.bannerUrl ? (
          <img src={profile.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        ) : (
          <div className="absolute inset-0" style={{ background: "radial-gradient(70% 60% at 30% 30%, rgb(var(--c-primary) / 0.2), transparent 70%)" }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-bg/20" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-2xl">{site.identity.siteName}</span>
          </Link>
          <div className="max-w-md">
            <p className="font-display text-5xl leading-[1.05]">{profile.displayName}</p>
            <p className="mt-3 text-sm text-ink/70">{site.identity.tagline}</p>
          </div>
        </div>
      </div>
      <div className="page-glow flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <LogoMark size={22} />
          <span className="font-display text-xl">{site.identity.siteName}</span>
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-center text-[11px] text-muted">Plataforma exclusiva para maiores de 18 anos.</p>
      </div>
    </div>
  );
}
