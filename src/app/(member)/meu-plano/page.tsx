import { Badge, buttonClass, EmptyState, PageHeader } from "@/components/ui/primitives";
import { paymentTone } from "@/lib/tones";
import { intervalLabel, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS, type PaymentMethod, type PaymentStatus, type SubscriptionStatus } from "@/lib/constants";
import { date, dateTime, money } from "@/lib/format";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getActiveSubscription } from "@/server/services/access.service";
import { getPaymentConfig } from "@/server/services/settings.service";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { PlanActions } from "./plan-actions";

export const metadata = { title: "Meu plano" };

export default async function MyPlanPage() {
  const user = await requireUser("/meu-plano");
  const [sub, payments, config] = await Promise.all([
    getActiveSubscription(user.id),
    db.payment.findMany({ where: { userId: user.id }, include: { plan: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    getPaymentConfig(),
  ]);

  return (
    <>
      <PageHeader eyebrow="Assinatura" title="Meu plano" />

      {sub ? (
        <div className="card card-pad">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <p className="font-display text-4xl">{sub.plan.name}</p>
                <Badge tone={sub.cancelAtPeriodEnd ? "warning" : "success"} dot>
                  {sub.cancelAtPeriodEnd ? "Cancelamento agendado" : SUBSCRIPTION_STATUS_LABELS[sub.status as SubscriptionStatus]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {money(sub.plan.priceCents)} · {intervalLabel(sub.plan.intervalMonths)}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted">Início do período</dt>
                  <dd className="mt-0.5 font-medium">{date(sub.currentPeriodStart)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{sub.cancelAtPeriodEnd ? "Acesso até" : "Próxima cobrança / expiração"}</dt>
                  <dd className="mt-0.5 font-medium">{date(sub.currentPeriodEnd)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Renovação</dt>
                  <dd className="mt-0.5 font-medium">{sub.gatewaySubscriptionId ? "Automática" : "Manual (renove antes do vencimento)"}</dd>
                </div>
              </dl>
            </div>
            <PlanActions
              canCancel={!sub.cancelAtPeriodEnd && sub.gateway !== "manual"}
              canRenew={!sub.gatewaySubscriptionId}
              methods={config.enabledMethods}
            />
          </div>
        </div>
      ) : (
        <div className="card">
          <EmptyState
            title="Você não possui assinatura ativa"
            description="Escolha um plano para liberar o conteúdo exclusivo."
            action={
              <Link href="/planos" className={buttonClass("glow")}>
                Ver planos
              </Link>
            }
          />
        </div>
      )}

      <h2 className="mb-3 mt-10 font-display text-3xl">Histórico de pagamentos</h2>
      <div className="card overflow-x-auto">
        {payments.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Plano</th>
                <th>Método</th>
                <th>Valor</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap text-muted">{dateTime(p.createdAt)}</td>
                  <td>{p.plan.name}</td>
                  <td>{PAYMENT_METHOD_LABELS[p.method as PaymentMethod]}</td>
                  <td className="tabular-nums">{money(p.amountCents)}</td>
                  <td>
                    <Badge tone={paymentTone[p.status]}>{PAYMENT_STATUS_LABELS[p.status as PaymentStatus]}</Badge>
                  </td>
                  <td className="text-right">
                    {p.status === "PENDING" && (
                      <Link href={`/pagamento/pendente?id=${p.id}`} className="text-xs font-semibold text-primary hover:underline">
                        Pagar
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={<Receipt className="h-5 w-5" />} title="Nenhum pagamento ainda" />
        )}
      </div>
    </>
  );
}
