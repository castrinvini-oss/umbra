import { Lock, RefreshCcw, ShieldCheck } from "lucide-react";
import { PlanCard } from "@/components/site/plan-card";
import { getCurrentUser } from "@/server/auth/session";
import { getActiveSubscription } from "@/server/services/access.service";
import { listPlans } from "@/server/services/plan.service";
import { getSiteConfig } from "@/server/services/settings.service";

export const metadata = { title: "Planos" };

export default async function PlansPage() {
  const [site, plans, user] = await Promise.all([getSiteConfig(), listPlans({ activeOnly: true }), getCurrentUser()]);
  const sub = user ? await getActiveSubscription(user.id) : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Assinatura</p>
        <h1 className="mt-3 font-display text-5xl leading-none sm:text-6xl">{site.texts.plansTitle}</h1>
        <p className="mt-4 text-muted">{site.texts.plansSubtitle}</p>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} current={sub?.planId === p.id} />
        ))}
      </div>
      {plans.length === 0 && <p className="mt-10 text-center text-muted">Nenhum plano disponível no momento.</p>}

      <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Pagamento seguro", text: "Processado pelo gateway. Não armazenamos dados de cartão." },
          { icon: RefreshCcw, title: "Sem fidelidade", text: "Cancele quando quiser e mantenha o acesso até o fim do período." },
          { icon: Lock, title: "Discrição", text: "Cobrança com descrição discreta e área privada protegida." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="card card-pad">
            <Icon className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
