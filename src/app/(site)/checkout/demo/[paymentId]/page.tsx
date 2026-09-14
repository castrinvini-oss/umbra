import { Lock } from "lucide-react";
import { notFound } from "next/navigation";
import { DemoControls, PaymentRedirector } from "@/components/payment/payment-watch";
import { money } from "@/lib/format";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { isDemoMode } from "@/server/services/settings.service";

export const metadata = { title: "Pagamento (demonstração)", robots: { index: false } };

/**
 * Simula a página de checkout HOSPEDADA de um gateway (onde o cliente digitaria
 * o cartão). Não coleta nenhum dado de cartão. Disponível apenas em DEMO_MODE.
 */
export default async function DemoHostedCheckout({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  if (!isDemoMode()) notFound();
  const user = await requireUser(`/checkout/demo/${paymentId}`);
  const payment = await db.payment.findFirst({ where: { id: paymentId, userId: user.id, gateway: "mock" }, include: { plan: true } });
  if (!payment) notFound();

  return (
    <div className="mx-auto max-w-md px-5 py-14">
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Gateway de demonstração</span>
          <Lock className="h-4 w-4 text-success" />
        </div>
        <div className="p-6">
          <p className="text-sm text-muted">Você está pagando</p>
          <p className="mt-1 font-display text-5xl tabular-nums">{money(payment.amountCents)}</p>
          <p className="mt-1 text-sm">Assinatura {payment.plan.name}</p>
          <div className="mt-6 rounded-field border border-line bg-bg/40 p-4 text-sm text-muted">
            Em produção, esta etapa acontece no ambiente do gateway (Asaas, Mercado Pago…), onde o cliente informa o cartão com segurança. Nenhum dado de
            cartão passa pelo nosso servidor.
          </div>
          <div className="mt-6">
            {payment.status === "PENDING" ? <DemoControls paymentId={payment.id} /> : <PaymentRedirector paymentId={payment.id} initial={payment.status} />}
          </div>
        </div>
      </div>
    </div>
  );
}
