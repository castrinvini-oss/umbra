import { z } from "zod";
import { can } from "@/lib/permissions";
import { db } from "@/server/db";
import { apiRoute, forbidden, notFound } from "@/server/http/api";
import { logAdmin } from "@/server/services/audit.service";
import { simulateMockWebhook } from "@/server/services/payment.service";

const schema = z.object({ paymentId: z.string().min(1), outcome: z.enum(["PAID", "FAILED"]) });

/**
 * MODO DEMO — simula a resposta do gateway enviando um webhook ASSINADO pelo
 * pipeline real. Bloqueado quando DEMO_MODE=false ou gateway ≠ mock.
 */
export const POST = apiRoute({ auth: "user", schema }, async ({ body, user, ip }) => {
  const payment = await db.payment.findUnique({ where: { id: body.paymentId } });
  if (!payment) throw notFound();
  const isOwner = payment.userId === user.id;
  const isAdmin = can(user.role, "payments.manage");
  if (!isOwner && !isAdmin) throw forbidden();
  const results = await simulateMockWebhook(payment.id, body.outcome);
  if (isAdmin && !isOwner) {
    await logAdmin({ actorId: user.id, action: "payment.simulate", entityType: "payment", entityId: payment.id, ip, metadata: { outcome: body.outcome } });
  }
  return { ok: true, results };
});
