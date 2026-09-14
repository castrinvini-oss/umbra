import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { can } from "@/lib/permissions";
import type { SiteConfig } from "@/lib/site-config";
import type { SessionUser } from "@/server/auth/session";
import { buttonClass, LogoMark } from "@/components/ui/primitives";

export function Brand({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      {logoUrl ? <img src={logoUrl} alt={name} className="h-7 w-auto max-w-[140px] object-contain" /> : <LogoMark />}
      {!logoUrl && <span className="font-display text-[1.6rem] leading-none tracking-tight">{name}</span>}
    </Link>
  );
}

export function SiteHeader({ site, user, logoUrl, demo }: { site: SiteConfig; user: SessionUser | null; logoUrl: string | null; demo: boolean }) {
  const staff = can(user?.role, "admin.access");
  return (
    <>
      {demo && (
        <div className="bg-secondary/15 px-4 py-1.5 text-center text-xs font-medium text-secondary">
          Modo Demo — pagamentos simulados, nenhuma cobrança real é feita.
        </div>
      )}
      {site.banner.announcementEnabled && site.banner.announcementText && (
        <div className="bg-primary px-4 py-2 text-center text-[13px] font-semibold text-primary-fg">
          {site.banner.announcementLink ? <Link href={site.banner.announcementLink} className="underline-offset-4 hover:underline">{site.banner.announcementText}</Link> : site.banner.announcementText}
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Brand name={site.identity.siteName} logoUrl={logoUrl} />
          <nav className="flex items-center gap-1.5">
            <Link href="/planos" className={buttonClass("ghost", "sm", "hidden sm:inline-flex")}>
              Planos
            </Link>
            {user ? (
              <Link href={staff ? "/admin/dashboard" : "/dashboard"} className={buttonClass("soft", "sm")}>
                {staff ? "Painel" : "Minha área"}
              </Link>
            ) : (
              <>
                <Link href="/login" className={buttonClass("ghost", "sm")}>
                  {site.texts.loginLabel}
                </Link>
                <Link href={site.texts.ctaLink || "/planos"} className={buttonClass("primary", "sm")}>
                  {site.texts.ctaLabel}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}

export function SiteFooter({ site }: { site: SiteConfig }) {
  return (
    <footer className="mt-20 border-t border-line/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark size={20} />
            <span className="font-display text-xl">{site.identity.siteName}</span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            {site.texts.footerText}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <Link href="/planos" className="hover:text-ink">Planos</Link>
          <Link href="/termos" className="hover:text-ink">Termos de uso</Link>
          <Link href="/privacidade" className="hover:text-ink">Privacidade</Link>
          <Link href="/termos#denuncias" className="hover:text-ink">Denúncias</Link>
        </nav>
      </div>
      <p className="border-t border-line/40 px-5 py-4 text-center text-[11px] text-muted/70">
        © {new Date().getFullYear()} {site.identity.siteName}. Proibido o acesso a menores de 18 anos. Todo o conteúdo retrata exclusivamente adultos.
      </p>
    </footer>
  );
}
