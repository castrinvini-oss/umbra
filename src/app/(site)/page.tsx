import { Check } from "lucide-react";
import Link from "next/link";
import { Feed } from "@/components/feed/feed";
import { CreatorHero } from "@/components/site/creator-hero";
import { PlanCard } from "@/components/site/plan-card";
import { buttonClass } from "@/components/ui/primitives";
import { intervalSuffix } from "@/lib/constants";
import { money } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/session";
import { getContentStats, getFeed, listCategories } from "@/server/services/content.service";
import { listPlans } from "@/server/services/plan.service";
import { getPublicProfile } from "@/server/services/profile.service";
import { getSiteConfig } from "@/server/services/settings.service";

export default async function CreatorPage() {
  const [site, profile, user, plans, stats, categories] = await Promise.all([
    getSiteConfig(),
    getPublicProfile(),
    getCurrentUser(),
    listPlans({ activeOnly: true }),
    getContentStats(),
    listCategories(),
  ]);
  const feed = site.layout.showFeedPreview ? await getFeed({ user, limit: 9 }) : null;
  const featured = plans.find((p) => p.featured) ?? plans[0];
  const featuredCats = site.layout.featuredCategoryIds.length
    ? categories.filter((c) => site.layout.featuredCategoryIds.includes(c.id))
    : categories;

  return (
    <>
      <CreatorHero profile={profile} texts={site.texts} banner={site.banner} stats={stats} showStats={site.layout.showStats} loggedIn={!!user} />

      <div className="mx-auto mt-12 grid max-w-6xl gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-12">
          {feed && (
            <section>
              <div className="mb-4 flex items-end justify-between">
                <h2 className="font-display text-3xl">{site.texts.feedTitle}</h2>
                <span className="text-sm text-muted">{stats.posts} publicações</span>
              </div>
              <Feed
                initialPosts={feed.posts}
                initialCursor={feed.nextCursor}
                categories={featuredCats}
                layout={site.layout.feedLayout}
                creator={{ displayName: profile.displayName, avatarUrl: profile.avatarUrl }}
                texts={site.texts}
                loggedIn={!!user}
                emptyTitle="Em breve, novas publicações"
              />
            </section>
          )}

          {site.layout.showPlansOnHome && plans.length > 0 && (
            <section id="planos" className="scroll-mt-24">
              <h2 className="font-display text-3xl">{site.texts.plansTitle}</h2>
              <p className="mt-1 text-sm text-muted">{site.texts.plansSubtitle}</p>
              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((p) => (
                  <PlanCard key={p.id} plan={p} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="order-first lg:order-none">
          <div className="card card-pad lg:sticky lg:top-24">
            <p className="eyebrow">{site.texts.benefitsTitle}</p>
            <ul className="mt-4 space-y-3">
              {site.texts.benefits.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="text-ink/85">{b}</span>
                </li>
              ))}
            </ul>
            {featured && (
              <>
                <div className="hairline my-5 opacity-60" />
                <p className="text-xs text-muted">A partir de</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-4xl tabular-nums">{money(Math.min(...plans.map((p) => p.priceCents)))}</span>
                  <span className="text-sm text-muted">{intervalSuffix(plans.reduce((a, b) => (a.priceCents <= b.priceCents ? a : b)).intervalMonths)}</span>
                </p>
                <Link href={site.texts.ctaLink || "/planos"} className={buttonClass("glow", "lg", "mt-4 w-full")}>
                  {site.texts.ctaLabel}
                </Link>
              </>
            )}
            <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">Pagamento seguro · Cancele quando quiser · Cobrança discreta</p>
          </div>
        </aside>
      </div>
    </>
  );
}
