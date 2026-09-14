"use client";

import { Check, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CreatorHero, type HeroProfile } from "@/components/site/creator-hero";
import { PlanCard, type PlanCardData } from "@/components/site/plan-card";
import { LogoMark } from "@/components/ui/primitives";
import { themeToCssVars, type SiteConfig } from "@/lib/site-config";

const DESIGN_WIDTH = 1180;

/** Preview em escala da página pública, renderizado com o rascunho (sem salvar). */
export function SitePreview({
  site,
  profile,
  plans,
  stats,
  logoUrl,
  focus = "full",
}: {
  site: SiteConfig;
  profile: HeroProfile;
  plans: PlanCardData[];
  stats: { posts: number; images: number; videos: number };
  logoUrl: string | null;
  focus?: "full" | "hero";
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const w = outer.current?.clientWidth ?? DESIGN_WIDTH;
      const s = Math.min(1, w / DESIGN_WIDTH);
      setScale(s);
      setHeight((inner.current?.scrollHeight ?? 600) * s);
    });
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);

  const vars = themeToCssVars(site.theme) as React.CSSProperties;

  return (
    <div ref={outer} className="relative w-full overflow-hidden rounded-card border border-line" style={{ height }}>
      <div
        ref={inner}
        data-card={site.theme.cardStyle}
        className="pointer-events-none absolute left-0 top-0 origin-top-left select-none bg-bg text-ink"
        style={{ ...vars, width: DESIGN_WIDTH, transform: `scale(${scale})` }}
        aria-hidden
      >
        {site.banner.announcementEnabled && site.banner.announcementText && (
          <div className="bg-primary px-4 py-2 text-center text-[13px] font-semibold text-primary-fg">{site.banner.announcementText}</div>
        )}
        <div className="flex h-16 items-center justify-between border-b border-line/60 px-8">
          <div className="flex items-center gap-2.5">
            {logoUrl ? <img src={logoUrl} alt="" className="h-7 w-auto" /> : <LogoMark />}
            {!logoUrl && <span className="font-display text-[1.6rem]">{site.identity.siteName}</span>}
          </div>
          <div className="flex gap-2">
            <span className="btn btn-ghost btn-sm">{site.texts.loginLabel}</span>
            <span className="btn btn-primary btn-sm">{site.texts.ctaLabel}</span>
          </div>
        </div>
        <CreatorHero profile={profile} texts={site.texts} banner={site.banner} stats={stats} showStats={site.layout.showStats} preview />
        {focus === "full" && (
          <div className="mx-auto mt-12 grid max-w-6xl grid-cols-[1fr_340px] gap-8 px-8 pb-16">
            <div className="space-y-10">
              {site.layout.showFeedPreview && (
                <div>
                  <p className="mb-4 font-display text-3xl">{site.texts.feedTitle}</p>
                  <div className={site.layout.feedLayout === "grid" ? "grid grid-cols-3 gap-3" : "space-y-4"}>
                    {Array.from({ length: site.layout.feedLayout === "grid" ? 3 : 1 }).map((_, i) => (
                      <div key={i} className={site.layout.feedLayout === "grid" ? "relative aspect-[4/5] overflow-hidden rounded-field bg-surface-2" : "card p-4"}>
                        {site.layout.feedLayout === "list" && <p className="mb-3 text-sm font-semibold">Publicação exclusiva</p>}
                        <div className={site.layout.feedLayout === "grid" ? "absolute inset-0 grid place-items-center" : "grid aspect-[4/3] place-items-center rounded-field bg-surface-2"}>
                          <div className="text-center">
                            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-primary/30 text-primary">
                              <Lock className="h-5 w-5" />
                            </span>
                            <p className="mt-2 text-sm font-semibold">{site.texts.lockedLabel}</p>
                            {site.layout.feedLayout === "list" && <span className="btn btn-glow btn-sm mt-3">{site.texts.unlockLabel}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {site.layout.showPlansOnHome && plans.length > 0 && (
                <div>
                  <p className="font-display text-3xl">{site.texts.plansTitle}</p>
                  <p className="mt-1 text-sm text-muted">{site.texts.plansSubtitle}</p>
                  <div className="mt-6 grid grid-cols-2 gap-5">
                    {plans.slice(0, 2).map((p) => (
                      <PlanCard key={p.id} plan={p} preview />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="card card-pad h-fit">
              <p className="eyebrow">{site.texts.benefitsTitle}</p>
              <ul className="mt-4 space-y-3">
                {site.texts.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-primary">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
              <span className="btn btn-glow btn-lg mt-5 w-full">{site.texts.ctaLabel}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
