import { z } from "zod";
import { paymentConfigSchema } from "@/lib/validators";
import { env } from "@/server/env";
import { apiRoute, badRequest } from "@/server/http/api";
import { buildGateway } from "@/server/payments";
import { logAdmin } from "@/server/services/audit.service";
import { getPaymentConfig, getPaymentConfigMasked, savePaymentConfig } from "@/server/services/settings.service";

export const GET = apiRoute({ auth: "settings.manage" }, async () => ({
  config: await getPaymentConfigMasked(),
  webhookUrl: `${env.appUrl}/api/payment/webhook`,
  demoMode: env.demoMode,
}));

/** Salva gateway e credenciais (criptografadas com AES-256-GCM). Campos vazios mantêm o valor atual. */
export const PUT = apiRoute({ auth: "settings.manage", schema: paymentConfigSchema }, async ({ body, user, ip }) => {
  if (body.gateway === "mock" && !env.demoMode) throw badRequest("O gateway de demonstração exige DEMO_MODE=true");
  await savePaymentConfig(body);
  await logAdmin({
    actorId: user.id,
    action: "payment.config",
    ip,
    metadata: { gateway: body.gateway, mode: body.mode, changedKeys: ["apiKey", "secretKey", "webhookSecret"].filter((k) => !!body[k as keyof typeof body]) },
  });
  return { ok: true, config: await getPaymentConfigMasked() };
});

const testSchema = paymentConfigSchema.partial().extend({ gateway: paymentConfigSchema.shape.gateway });

/** Testa a conexão usando os valores do formulário (ou os salvos, se vazios). */
export const POST = apiRoute({ auth: "settings.manage", schema: z.object({ config: testSchema }) }, async ({ body }) => {
  const saved = await getPaymentConfig();
  const merged = {
    ...saved,
    gateway: body.config.gateway,
    mode: body.config.mode ?? saved.mode,
    apiKey: body.config.apiKey || saved.apiKey,
    secretKey: body.config.secretKey || saved.secretKey,
    webhookSecret: body.config.webhookSecret || saved.webhookSecret,
  };
  try {
    const gateway = buildGateway(merged);
    return await gateway.testConnection();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Falha ao testar" };
  }
});
