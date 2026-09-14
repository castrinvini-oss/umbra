import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { intervalSuffix } from "@/lib/constants";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/ui/primitives";

export type PlanCardData = {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  intervalMonths: number;
  benefits: string[];
  featured: boolean;
};

export function PlanCard({ plan, current, preview }: { plan: PlanCardData; current?: boolean; preview?: boolean }) {
  const monthly = plan.intervalMonths > 1 ? Math.round(plan.priceCents / plan.intervalMonths) : null;
  const Cta = preview ? "span" : Link;
  return (
    <div
      className={cn(
        "card relative flex flex-col p-6 transition duration-300",
        plan.featured ? "border-primary/40" : "hover:border-ink/15",
      )}
      style={plan.featured ? { boxShadow: "0 30px 80px -40px rgb(var(--c-primary) / 0.55)" } : undefined}
    >
      {plan.featured && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-fg">
          <Sparkles className="h-3 w-3" /> Mais escolhido
        </span>
      )}
      <p className="eyebrow">{plan.name}</p>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-5xl leading-none tabular-nums">{money(plan.priceCents)}</span>
        <span className="text-sm text-muted">{intervalSuffix(plan.intervalMonths)}</span>
      </div>
      {monthly && <p className="mt-1.5 text-xs text-primary">equivale a {money(monthly)}/mês</p>}
      {plan.description && <p className="mt-3 text-sm leading-relaxed text-muted">{plan.description}</p>}
      <div className="hairline my-5 opacity-60" />
      <ul className="flex-1 space-y-2.5">
        {plan.benefits.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-ink/85">{b}</span>
          </li>
        ))}
      </ul>
      {current ? (
        <span className={buttonClass("soft", "lg", "mt-6 w-full")}>Seu plano atual</span>
      ) : (
        <Cta href={`/checkout?plano=${plan.slug}`} className={buttonClass(plan.featured ? "glow" : "outline", "lg", "mt-6 w-full")}>
          Assinar {plan.name}
        </Cta>
      )}
    </div>
  );
}
