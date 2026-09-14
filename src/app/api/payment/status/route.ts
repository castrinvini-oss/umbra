import { db } from "@/server/db";
import { apiRoute, notFound } from "@/server/http/api";

/** Consulta de status para a tela de pagamento (somente leitura — não altera nada). */
export const GET = apiRoute({ auth: "user" }, async ({ req, user }) => {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const payment = await db.payment.findFirst({
    where: { id, userId: user.id },
    select: { id: true, status: true, subscription: { select: { status: true, currentPeriodEnd: true } } },
  });
  if (!payment) throw notFound("Pagamento não encontrado");
  return {
    status: payment.status,
    subscriptionStatus: payment.subscription?.status ?? null,
    accessUntil: payment.subscription?.currentPeriodEnd ?? null,
  };
});
