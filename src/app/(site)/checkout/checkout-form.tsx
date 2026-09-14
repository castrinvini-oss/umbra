"use client";

import { Barcode, Check, CreditCard, Lock, QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AccountFields, emptyAccount } from "@/components/auth/account-fields";
import { Button, buttonClass, Field, Input } from "@/components/ui/primitives";
import { api, ApiClientError } from "@/lib/api-client";
import { intervalSuffix, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PlanDTO } from "@/server/services/plan.service";

const METHOD_INFO: Record<PaymentMethod, { icon: typeof QrCode; text: string }> = {
  PIX: { icon: QrCode, text: "Aprovação em segundos" },
  CARD: { icon: CreditCard, text: "Renovação automática" },
  BOLETO: { icon: Barcode, text: "Compensa em até 3 dias úteis" },
  OTHER: { icon: CreditCard, text: "Outras opções do gateway" },
};

function formatCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function CheckoutForm(props: {
  plan: PlanDTO;
  user: { name: string; email: string } | null;
  methods: PaymentMethod[];
  requireCpf: boolean;
  gatewayError: string | null;
  demo: boolean;
  currentPlanName: string | null;
  samePlan: boolean;
}) {
  const { plan } = props;
  const [method, setMethod] = useState<PaymentMethod>(props.methods[0] ?? "PIX");
  const [account, setAccount] = useState(emptyAccount);
  const [cpf, setCpf] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setError(null);
    try {
      const res = await api<{ redirect: string }>("/api/checkout", {
        method: "POST",
        body: {
          planId: plan.id,
          method,
          cpf: cpf || undefined,
          account: props.user ? undefined : { ...account, phone: account.phone || undefined },
        },
      });
      window.location.assign(res.redirect);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fields ?? {});
        setError(err.message);
      }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="order-2 space-y-6 lg:order-1">
        <div>
          <p className="eyebrow">Checkout seguro</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl">Finalize sua assinatura</h1>
        </div>

        {props.samePlan && (
          <div className="rounded-card border border-success/30 bg-success/10 p-4 text-sm text-success">
            Você já possui o plano {plan.name} ativo.{" "}
            <Link href="/conteudos" className="font-semibold underline">
              Ver conteúdos
            </Link>
          </div>
        )}
        {props.currentPlanName && !props.samePlan && (
          <div className="rounded-card border border-line bg-surface-2/60 p-4 text-sm text-muted">
            Seu plano atual é <b className="text-ink">{props.currentPlanName}</b>. Ao confirmar o pagamento, ele será substituído por <b className="text-ink">{plan.name}</b>.
          </div>
        )}

        <section className="card card-pad">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">1. Sua conta</h2>
            {!props.user && (
              <Link href={`/login?next=${encodeURIComponent(`/checkout?plano=${plan.slug}`)}`} className="text-sm text-primary hover:underline">
                Já tenho conta
              </Link>
            )}
          </div>
          <div className="mt-5">
            {props.user ? (
              <div className="flex items-center gap-3 rounded-field bg-surface-2/60 px-4 py-3 text-sm">
                <Check className="h-4 w-4 text-success" />
                <span>
                  Conectado como <b>{props.user.name}</b> <span className="text-muted">({props.user.email})</span>
                </span>
              </div>
            ) : (
              <AccountFields value={account} onChange={setAccount} errors={errors} prefix="account." />
            )}
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="font-semibold">2. Pagamento</h2>
          {props.gatewayError ? (
            <p className="mt-4 rounded-field bg-danger/10 px-3 py-2 text-sm text-danger">Pagamentos indisponíveis: {props.gatewayError}</p>
          ) : (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {props.methods.map((m) => {
                  const Icon = METHOD_INFO[m].icon;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-field border p-4 text-left transition",
                        method === m ? "border-primary/60 bg-primary/10" : "border-line hover:border-ink/20",
                      )}
                    >
                      <Icon className={cn("h-5 w-5", method === m ? "text-primary" : "text-muted")} />
                      <span className="text-sm font-semibold">{PAYMENT_METHOD_LABELS[m]}</span>
                      <span className="text-xs text-muted">{METHOD_INFO[m].text}</span>
                    </button>
                  );
                })}
              </div>

              {(props.requireCpf || method === "PIX" || method === "BOLETO") && (
                <Field label={props.requireCpf ? "CPF" : "CPF (opcional)"} hint="Exigido por alguns meios de pagamento. Armazenado criptografado." error={errors.cpf} className="mt-5 max-w-xs">
                  <Input inputMode="numeric" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" invalid={!!errors.cpf} />
                </Field>
              )}

              <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {method === "CARD"
                  ? "Você digitará os dados do cartão no ambiente seguro do gateway de pagamento. Não armazenamos dados de cartão."
                  : "O acesso é liberado automaticamente assim que o gateway confirmar o pagamento."}
              </p>
            </>
          )}
        </section>

        {error && <p className="rounded-field bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

        <Button type="submit" variant="glow" size="lg" className="w-full sm:w-auto sm:min-w-[260px]" loading={loading} disabled={!!props.gatewayError || props.samePlan || !props.methods.length}>
          <ShieldCheck className="h-4 w-4" />
          {method === "PIX" ? "Gerar PIX" : method === "CARD" ? "Continuar para pagamento" : "Gerar boleto"} · {money(plan.priceCents)}
        </Button>
        {props.demo && <p className="text-xs text-secondary">Modo Demo: nenhuma cobrança real será feita. Você poderá simular aprovação ou recusa.</p>}
      </div>

      <aside className="order-1 lg:order-2">
        <div className="card card-pad lg:sticky lg:top-24">
          <p className="eyebrow">Resumo</p>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{plan.name}</p>
              <p className="text-sm text-muted">{plan.description}</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {plan.benefits.slice(0, 6).map((b) => (
              <li key={b} className="flex gap-2 text-sm text-ink/80">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {b}
              </li>
            ))}
          </ul>
          <div className="hairline my-5 opacity-60" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted">Total</span>
            <span>
              <span className="font-display text-4xl tabular-nums">{money(plan.priceCents)}</span>
              <span className="text-sm text-muted">{intervalSuffix(plan.intervalMonths)}</span>
            </span>
          </div>
          <Link href="/planos" className={buttonClass("ghost", "sm", "mt-4 w-full")}>
            Trocar plano
          </Link>
        </div>
      </aside>
    </form>
  );
}
