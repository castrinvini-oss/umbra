import { db } from "@/server/db";
import { apiRoute, notFound } from "@/server/http/api";
import { syncPaymentStatus } from "@/server/services/payment.service";

// Reconciliação: se o webhook se perder, a tela de pagamento consulta o
// gateway (servidor → API do gateway, nunca dados do navegador) no máximo a
// cada 20s por pagamento, e só a partir de 15s depois da criação.
const SYNC_EVERY_MS = 20_000;
const g = globalThis as unknown as { __umbraPaySync?: Map<string, number> };
const lastSync = (g.__umbraPaySync ??= new Map());

/** Status do pagamento para a tela de pagamento. */
export const GET = apiRoute({ auth: "user" }, async ({ req, user }) => {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const select = { id: true, status: true, gateway: true, gatewayPaymentId: true, createdAt: true, subscription: { select: { status: true, currentPeriodEnd: true } } } as const;
  let payment = await db.payment.findFirst({ where: { id, userId: user.id }, select });
  if (!payment) throw notFound("Pagamento não encontrado");

  const now = Date.now();
  if (
    payment.status === "PENDING" &&
    payment.gateway !== "mock" &&
    payment.gatewayPaymentId &&
    now - payment.createdAt.getTime() > 15_000 &&
    now - (lastSync.get(payment.id) ?? 0) > SYNC_EVERY_MS
  ) {
    lastSync.set(payment.id, now);
    if (lastSync.size > 5000) lastSync.clear();
    try {
      await syncPaymentStatus(payment.id);
      payment = (await db.payment.findFirst({ where: { id, userId: user.id }, select })) ?? payment;
    } catch (err) {
      console.error("[payment/status] reconciliação falhou", err);
    }
  }

  return {
    status: payment.status,
    subscriptionStatus: payment.subscription?.status ?? null,
    accessUntil: payment.subscription?.currentPeriodEnd ?? null,
  };
});
