import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validators";
import { apiRoute } from "@/server/http/api";
import { RATE_RULES } from "@/server/security/rate-limit";
import { requestPasswordReset, resetPassword } from "@/server/services/user.service";

/** Solicita link de recuperação (resposta idêntica exista ou não a conta). */
export const POST = apiRoute(
  { auth: "public", schema: forgotPasswordSchema, rate: ["pwd-forgot", RATE_RULES.passwordReset] },
  async ({ body }) => {
    await requestPasswordReset(body.email);
    return { ok: true, message: "Se o e-mail estiver cadastrado, você receberá um link em instantes." };
  },
);

/** Define nova senha a partir do token recebido por e-mail. */
export const PUT = apiRoute(
  { auth: "public", schema: resetPasswordSchema, rate: ["pwd-reset", RATE_RULES.passwordReset] },
  async ({ body }) => {
    await resetPassword(body.token, body.password);
    return { ok: true, redirect: "/login?redefinida=1" };
  },
);
