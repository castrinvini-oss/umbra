import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, getIp } from "@/server/http/api";
import { rateLimit, RATE_RULES } from "@/server/security/rate-limit";
import { processWebhook } from "@/server/services/payment.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/payment/webhook
 *
 * Único ponto que confirma pagamentos. Fluxo:
 *   1. valida a autenticidade (assinatura/token do gateway ativo)
 *   2. registra o evento (idempotência por gateway + eventId)
 *   3. atualiza pagamento → assinatura → usuário/lead → vencimento
 *
 * Sem CSRF (chamada servidor-a-servidor) — a proteção é a assinatura.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimit(`webhook:${getIp(req)}`, RATE_RULES.webhook);
    if (!limited.ok) return NextResponse.json({ error: "rate limited" }, { status: 429 });
    const rawBody = await req.text();
    if (rawBody.length > 1_000_000) return NextResponse.json({ error: "payload too large" }, { status: 413 });
    const results = await processWebhook(rawBody, req.headers, req.nextUrl);
    return NextResponse.json({ received: true, results });
  } catch (err) {
    return errorResponse(err);
  }
}
