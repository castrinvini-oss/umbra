import { cookies } from "next/headers";
import { COOKIE } from "@/lib/constants";
import { checkoutSchema } from "@/lib/validators";
import { createSession } from "@/server/auth/session";
import { apiRoute, HttpError } from "@/server/http/api";
import { RATE_RULES } from "@/server/security/rate-limit";
import { startCheckout } from "@/server/services/payment.service";
import { registerUser } from "@/server/services/user.service";

/**
 * Inicia o checkout. Visitante sem conta envia `account` e a conta é criada no
 * mesmo passo. Nunca recebe dados de cartão: o cartão é digitado no checkout
 * hospedado pelo gateway.
 */
export const POST = apiRoute({ auth: "public", schema: checkoutSchema, rate: ["checkout", RATE_RULES.checkout] }, async ({ body, user }) => {
  let userId = user?.id;
  if (!userId) {
    if (!body.account) throw new HttpError(401, "Crie sua conta ou faça login para continuar");
    const source = (await cookies()).get(COOKIE.lead)?.value;
    const created = await registerUser({ ...body.account, source, planId: body.planId });
    await createSession(created.id);
    userId = created.id;
  }
  const { payment, redirect } = await startCheckout({ userId, planId: body.planId, method: body.method, cpf: body.cpf });
  return { paymentId: payment.id, status: payment.status, redirect };
});
