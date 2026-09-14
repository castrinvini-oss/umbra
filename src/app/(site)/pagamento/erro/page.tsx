import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/constants";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata = { title: "Pagamento não aprovado", robots: { index: false } };

export default async function PaymentErrorPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const user = await requireUser(`/pagamento/erro?id=${id ?? ""}`);
  const payment = id ? await db.payment.findFirst({ where: { id, userId: user.id }, include: { plan: true } }) : null;

  return (
    <div className="mx-auto max-w-lg px-5 py-16 sm:py-24">
      <div className="card p-8 text-center sm:p-10">
        <XCircle className="mx-auto h-14 w-14 text-danger" />
        <h1 className="mt-5 font-display text-4xl">Pagamento não aprovado</h1>
        <p className="mt-2 text-sm text-muted">
          {payment?.failureReason
            ? `Motivo informado: ${payment.failureReason}.`
            : payment
              ? `Status: ${PAYMENT_STATUS_LABELS[payment.status as PaymentStatus]}.`
              : "Não foi possível concluir o pagamento."}{" "}
          Nenhum valor foi cobrado por esta tentativa.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button href={payment ? `/checkout?plano=${payment.plan.slug}` : "/planos"} variant="glow" size="lg">
            Tentar novamente
          </Button>
          <Button href="/planos" variant="outline" size="lg">
            Ver planos
          </Button>
        </div>
      </div>
    </div>
  );
}
