import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants";
import { apiRoute, HttpError } from "@/server/http/api";
import { getActiveSubscription } from "@/server/services/access.service";
import { startCheckout } from "@/server/services/payment.service";
import { cancelSubscription } from "@/server/services/subscription.service";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), reason: z.string().max(300).optional() }),
  z.object({ action: z.literal("renew"), method: z.enum(PAYMENT_METHODS) }),
]);

/** Ações do assinante sobre a própria assinatura. */
export const POST = apiRoute({ auth: "user", schema }, async ({ body, user }) => {
  const sub = await getActiveSubscription(user.id);
  if (!sub) throw new HttpError(404, "Você não possui assinatura ativa");

  if (body.action === "cancel") {
    if (sub.cancelAtPeriodEnd) throw new HttpError(400, "O cancelamento já está agendado");
    await cancelSubscription(sub.id, { immediate: false, by: "user", reason: body.reason });
    return { ok: true };
  }

  // Renovação antecipada (métodos sem recorrência automática, ex.: PIX).
  const { redirect } = await startCheckout({ userId: user.id, planId: sub.planId, method: body.method, kind: "RENEWAL" });
  return { ok: true, redirect };
});
