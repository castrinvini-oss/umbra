import { z } from "zod";
import { apiRoute } from "@/server/http/api";
import { logAdmin } from "@/server/services/audit.service";
import { refundPayment, simulateMockWebhook, syncPaymentStatus } from "@/server/services/payment.service";

const schema = z.object({ action: z.enum(["refund", "sync", "simulatePaid", "simulateFailed"]) });

export const POST = apiRoute({ auth: "payments.manage", schema }, async ({ params, body, user, ip }) => {
  const id = params.id!;
  switch (body.action) {
    case "refund":
      return { status: await refundPayment(id, { id: user.id, ip }) };
    case "sync":
      return { status: await syncPaymentStatus(id) };
    case "simulatePaid":
    case "simulateFailed": {
      const outcome = body.action === "simulatePaid" ? "PAID" : "FAILED";
      const results = await simulateMockWebhook(id, outcome);
      await logAdmin({ actorId: user.id, action: "payment.simulate", entityType: "payment", entityId: id, ip, metadata: { outcome } });
      return { results };
    }
  }
});
