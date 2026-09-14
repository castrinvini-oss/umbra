import { LogoMark } from "@/components/ui/primitives";
import { getPublicProfile } from "@/server/services/profile.service";
import { getSiteConfig } from "@/server/services/settings.service";
import { AgeGateActions } from "./actions";

export const metadata = { robots: { index: false } };

export default async function AgeGatePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, site, profile] = await Promise.all([searchParams, getSiteConfig(), getPublicProfile()]);
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      {profile.bannerUrl && (
        <img src={profile.bannerUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-3xl" />
      )}
      <div className="absolute inset-0 bg-bg/70" />
      <div className="card relative w-full max-w-md p-7 text-center shadow-2xl shadow-black/60 sm:p-9 animate-fade-up">
        <div className="mx-auto flex items-center justify-center gap-2">
          <LogoMark size={24} />
          <span className="font-display text-2xl">{site.identity.siteName}</span>
        </div>
        <div className="mx-auto mt-7 grid h-20 w-20 place-items-center rounded-full border border-primary/40 font-display text-4xl text-primary">18+</div>
        <h1 className="mt-6 text-xl font-bold">{site.texts.ageGateTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{site.texts.ageGateText}</p>
        <AgeGateActions next={safeNext} />
        <p className="mt-6 text-[11px] leading-relaxed text-muted/80">
          Ao entrar você concorda com os <a href="/termos" className="underline underline-offset-2">Termos de uso</a> e a{" "}
          <a href="/privacidade" className="underline underline-offset-2">Política de privacidade</a>. Pais e responsáveis: utilizem ferramentas de
          controle parental — este site é identificado com o selo RTA.
        </p>
      </div>
    </main>
  );
}
