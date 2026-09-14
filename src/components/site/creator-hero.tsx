import { Images, MapPin, Users, Video, FileText } from "lucide-react";
import Link from "next/link";
import type { BannerSettings, PageTexts } from "@/lib/site-config";
import { numCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar, buttonClass, VerifiedBadge } from "@/components/ui/primitives";

export type HeroProfile = {
  displayName: string;
  username: string;
  bio: string;
  headline: string;
  location: string | null;
  verified: boolean;
  avatarUrl: string | null;
  bannerUrl: string | null;
  socialLinks: { label: string; url: string }[];
  subscriberCount: number | null;
};

const HEIGHTS = { sm: "h-40 sm:h-56", md: "h-52 sm:h-80", lg: "h-64 sm:h-[26rem]" };

/** Componente puro: usado na página pública e no preview ao vivo do editor. */
export function CreatorHero({
  profile,
  texts,
  banner,
  stats,
  showStats = true,
  loggedIn = false,
  preview = false,
}: {
  profile: HeroProfile;
  texts: Pick<PageTexts, "ctaLabel" | "ctaLink" | "ctaStyle" | "loginLabel">;
  banner: BannerSettings;
  stats?: { posts: number; images: number; videos: number };
  showStats?: boolean;
  loggedIn?: boolean;
  preview?: boolean;
}) {
  const ctaVariant = texts.ctaStyle === "outline" ? "outline" : texts.ctaStyle === "solid" ? "primary" : "glow";
  const Cta = preview ? "span" : Link;

  return (
    <section className="relative">
      <div className={cn(banner.style === "contained" && "mx-auto max-w-6xl px-0 sm:px-6 sm:pt-4")}>
        <div className={cn("relative overflow-hidden bg-surface-2", HEIGHTS[banner.height], banner.style === "contained" && "sm:rounded-card")}>
          {profile.bannerUrl ? (
            <img
              src={profile.bannerUrl}
              alt=""
              className="protected-media h-full w-full object-cover"
              style={{ objectPosition: `center ${banner.position}` }}
              draggable={false}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(80% 120% at 70% 0%, rgb(var(--c-primary) / 0.25), transparent 60%), radial-gradient(60% 100% at 10% 100%, rgb(var(--c-secondary) / 0.2), transparent 60%)",
              }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to top, rgb(var(--c-bg)) 0%, rgb(var(--c-bg) / ${banner.overlay / 100}) 45%, rgb(var(--c-bg) / ${banner.overlay / 300}) 100%)` }}
          />
        </div>
      </div>

      <div className="relative mx-auto -mt-16 max-w-6xl px-5 sm:-mt-20 sm:px-8">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:text-left">
          <div className="rounded-full bg-bg p-1.5 shadow-2xl shadow-black/50">
            <Avatar src={profile.avatarUrl} name={profile.displayName} size={132} className="ring-1 ring-primary/30" />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h1 className="truncate font-display text-[2.6rem] leading-[1.05] tracking-tight sm:text-5xl">{profile.displayName}</h1>
              {profile.verified && <VerifiedBadge size={22} />}
            </div>
            <p className="mt-1 text-sm text-muted">
              @{profile.username}
              {profile.location && (
                <span className="ml-3 inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {profile.location}
                </span>
              )}
            </p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto sm:pb-1.5">
            <Cta href={texts.ctaLink || "/planos"} className={buttonClass(ctaVariant, "lg", "flex-1 sm:flex-none")}>
              {texts.ctaLabel}
            </Cta>
            {!loggedIn && (
              <Cta href="/login" className={buttonClass("outline", "lg", "flex-1 sm:flex-none")}>
                {texts.loginLabel}
              </Cta>
            )}
            {loggedIn && (
              <Cta href="/dashboard" className={buttonClass("outline", "lg", "flex-1 sm:flex-none")}>
                Minha área
              </Cta>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="max-w-2xl">
            {profile.headline && <p className="text-[15px] font-semibold text-primary">{profile.headline}</p>}
            <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed text-ink/80">{profile.bio}</p>
            {profile.socialLinks.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                {profile.socialLinks.map((l) => (
                  <a key={l.url} href={preview ? undefined : l.url} target="_blank" rel="noopener noreferrer nofollow" className="chip hover:border-primary/50 hover:text-ink">
                    {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {showStats && stats && (
            <dl className="flex justify-center gap-6 sm:justify-end">
              <Stat icon={<FileText className="h-4 w-4" />} label="Posts" value={stats.posts} />
              <Stat icon={<Images className="h-4 w-4" />} label="Fotos" value={stats.images} />
              <Stat icon={<Video className="h-4 w-4" />} label="Vídeos" value={stats.videos} />
              {profile.subscriberCount !== null && <Stat icon={<Users className="h-4 w-4" />} label="Assinantes" value={profile.subscriberCount} />}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="text-center">
      <dd className="font-display text-3xl leading-none tabular-nums">{numCompact(value)}</dd>
      <dt className="mt-1.5 flex items-center justify-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted">
        {icon}
        {label}
      </dt>
    </div>
  );
}
