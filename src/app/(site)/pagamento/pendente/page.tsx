import { Clock, ExternalLink } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { DemoControls, PaymentRedirector } from "@/components/payment/payment-watch";
import { CopyButton } from "@/components/ui/overlay";
import { Button } from "@/components/ui/primitives";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { dateTime, money } from "@/lib/format";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { isDemoMode } from "@/server/services/settings.service";

export const metadata = { title: "Pagamento pendente", robots: { index: false } };

export default async function PendingPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const user = await requireUser(`/pagamento/pendente?id=${id ?? ""}`);
  const payment = id ? await db.payment.findFirst({ where: { id, userId: user.id }, include: { plan: true } }) : null;
  if (!payment) notFound();
  if (payment.status === "PAID") redirect(`/pagamento/sucesso?id=${payment.id}`);
  if (payment.status !== "PENDING") redirect(`/pagamento/erro?id=${payment.id}`);
  const demo = isDemoMode() && payment.gateway === "mock";

  return (
    <div className="mx-auto max-w-lg px-5 py-12 sm:py-16">
      <div className="card p-6 text-center sm:p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-warning/15 text-warning">
          <Clock className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-4xl">{payment.pixCopyPaste ? "Pague com PIX" : "Pagamento pendente"}</h1>
        <p className="mt-2 text-sm text-muted">
          {payment.plan.name} · <b className="text-ink">{money(payment.amountCents)}</b> · {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]}
        </p>

        {payment.pixCopyPaste ? (
          <div className="mt-7">
            {payment.pixQrBase64 && (
              <div className="mx-auto w-fit rounded-card bg-white p-3">
                <img src={payment.pixQrBase64} alt="QR Code PIX" className="h-56 w-56" />
              </div>
            )}
            <p className="mt-5 text-xs text-muted">Ou copie o código PIX:</p>
            <div className="mt-2 flex gap-2">
              <input readOnly value={payment.pixCopyPaste} className="input font-mono text-xs" />
              <CopyButton value={payment.pixCopyPaste} />
            </div>
            {payment.expiresAt && <p className="mt-3 text-xs text-muted">Válido até {dateTime(payment.expiresAt)}</p>}
          </div>
        ) : payment.checkoutUrl ? (
          <Button href={payment.checkoutUrl} external={payment.checkoutUrl.startsWith("http")} variant="glow" size="lg" className="mt-7">
            Concluir pagamento <ExternalLink className="h-4 w-4" />
          </Button>
        ) : null}

        <div className="mt-7">
          <PaymentRedirector paymentId={payment.id} initial={payment.status} />
        </div>
        {demo && (
          <div className="mt-6 text-left">
            <DemoControls paymentId={payment.id} />
          </div>
        )}
      </div>
    </div>
  );
}
