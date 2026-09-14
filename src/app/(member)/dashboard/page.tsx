import { ArrowRight, CalendarClock, CreditCard, Crown, Sparkles } from "lucide-react";
import Link from "next/link";
import { Feed } from "@/components/feed/feed";
import { Avatar, Badge, buttonClass } from "@/components/ui/primitives";
import { SUBSCRIPTION_STATUS_LABELS, type SubscriptionStatus } from "@/lib/constants";
import { date, money } from "@/lib/format";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getActiveSubscription } from "@/server/services/access.service";
import { getFeed, listCategories } from "@/server/services/content.service";
import { resolvePublicUrls } from "@/server/services/media.service";
import { getPublicProfile } from "@/server/services/profile.service";
import { getSiteConfig } from "@/server/services/settings.service";

export const metadata = { title: "Início" };

export default async function MemberDashboard() {
  const user = await requireUser("/dashboard");
  const [sub, site, profile, feed, categories, pending, urls] = await Promise.all([
    getActiveSubscription(user.id),
    getSiteConfig(),
    getPublicProfile(),
    getFeed({ user, limit: 6 }),
    listCategories(),
    db.payment.findFirst({ where: { userId: user.id, status: "PENDING" }, orderBy: { createdAt: "desc" }, include: { plan: true } }),
    resolvePublicUrls([user.avatarMediaId]),
  ]);
  const daysLeft = sub?.currentPeriodEnd ? Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / 86400_000)) : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Avatar src={user.avatarMediaId ? urls.get(user.avatarMediaId) : null} name={user.name} size={56} />
        <div>
          <p className="text-sm text-muted">Olá,</p>
          <h1 className="font-display text-4xl leading-none">{user.name.split(" ")[0]}</h1>
        </div>
      </div>

      {pending && (
        <Link href={`/pagamento/pendente?id=${pending.id}`} className="card flex items-center justify-between gap-4 border-warning/30 p-4 transition hover:border-warning/60">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm font-semibold">Pagamento pendente · {pending.plan.name}</p>
              <p className="text-xs text-muted">{money(pending.amountCents)} — conclua para liberar o acesso</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted" />
        </Link>
      )}

      {sub ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card card-pad sm:col-span-1">
            <p className="eyebrow flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-primary" /> Plano atual
            </p>
            <p className="mt-3 font-display text-4xl">{sub.plan.name}</p>
            <Badge tone={sub.status === "ACTIVE" ? "success" : "warning"} dot className="mt-3">
              {sub.cancelAtPeriodEnd ? "Cancelamento agendado" : SUBSCRIPTION_STATUS_LABELS[sub.status as SubscriptionStatus]}
            </Badge>
          </div>
          <div className="card card-pad">
            <p className="eyebrow flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> {sub.cancelAtPeriodEnd || sub.gateway === "manual" ? "Acesso até" : "Próxima cobrança"}
            </p>
            <p className="mt-3 font-display text-4xl tabular-nums">{date(sub.currentPeriodEnd)}</p>
            <p className="mt-2 text-xs text-muted">{daysLeft} dias restantes no período</p>
          </div>
          <div className="card card-pad">
            <p className="eyebrow">Valor</p>
            <p className="mt-3 font-display text-4xl tabular-nums">{money(sub.plan.priceCents)}</p>
            <Link href="/meu-plano" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Gerenciar assinatura <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="card relative overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-0" style={{ background: "radial-gradient(60% 120% at 100% 0%, rgb(var(--c-primary) / 0.14), transparent 70%)" }} />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Sem assinatura ativa
              </p>
              <p className="mt-2 font-display text-3xl">Desbloqueie todo o conteúdo de {profile.displayName}</p>
              <p className="mt-1 text-sm text-muted">Escolha um plano e tenha acesso imediato após a confirmação do pagamento.</p>
            </div>
            <Link href="/planos" className={buttonClass("glow", "lg")}>
              {site.texts.ctaLabel}
            </Link>
          </div>
        </div>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-3xl">Recentes</h2>
          <Link href="/conteudos" className="text-sm font-semibold text-primary hover:underline">
            Ver tudo
          </Link>
        </div>
        <Feed
          initialPosts={feed.posts}
          initialCursor={null}
          categories={categories}
          layout="grid"
          creator={{ displayName: profile.displayName, avatarUrl: profile.avatarUrl }}
          texts={site.texts}
          loggedIn
        />
      </section>
    </div>
  );
}
