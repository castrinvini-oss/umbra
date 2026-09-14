import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { safeEqual } from "@/server/security/crypto";
import { purgeRateLimits } from "@/server/security/rate-limit";
import { runSubscriptionJob } from "@/server/services/subscription.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Job de assinaturas (expiração, cancelamentos agendados, cobranças vencidas)
 * + limpeza dos contadores de rate limit.
 *
 * Vercel Cron chama com GET e envia "Authorization: Bearer $CRON_SECRET"
 * automaticamente quando a variável CRON_SECRET existe no projeto (vercel.json).
 * Fora da Vercel: curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/subscriptions
 */
async function handle(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!env.cronSecret || !safeEqual(auth, env.cronSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runSubscriptionJob();
  const purgedRateLimits = await purgeRateLimits();
  return NextResponse.json({ ok: true, ...result, purgedRateLimits });
}

export const GET = handle;
export const POST = handle;
