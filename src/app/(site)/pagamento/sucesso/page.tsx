import { notFound } from "next/navigation";
import { SuccessStatus } from "@/components/payment/payment-watch";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata = { title: "Pagamento", robots: { index: false } };

/**
 * Página de retorno do gateway. Chegar aqui NÃO libera acesso: o status exibido
 * vem do banco, atualizado exclusivamente pelo webhook/consulta ao gateway.
 */
export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const user = await requireUser(`/pagamento/sucesso?id=${id ?? ""}`);
  const payment = id ? await db.payment.findFirst({ where: { id, userId: user.id }, select: { id: true, status: true } }) : null;
  if (!payment) notFound();
  return (
    <div className="mx-auto max-w-lg px-5 py-16 sm:py-24">
      <div className="card p-8 sm:p-10">
        <SuccessStatus paymentId={payment.id} initial={payment.status} />
      </div>
    </div>
  );
}
