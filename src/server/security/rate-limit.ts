// Rate limiting com janela fixa.
//  - "database": contador no Postgres, compartilhado entre todas as instâncias
//    serverless da Vercel (padrão em produção).
//  - "memory": contador no processo (desenvolvimento / servidor único).

import { db } from "../db";
import { env } from "../env";

export type RateRule = { limit: number; windowSec: number };
export type RateResult = { ok: true; remaining: number } | { ok: false; retryAfter: number };

export const RATE_RULES = {
  login: { limit: 8, windowSec: 60 * 5 },
  register: { limit: 5, windowSec: 60 * 10 },
  checkout: { limit: 10, windowSec: 60 * 10 },
  report: { limit: 5, windowSec: 60 * 10 },
  passwordReset: { limit: 3, windowSec: 60 * 15 },
  webhook: { limit: 300, windowSec: 60 },
  upload: { limit: 60, windowSec: 60 * 10 },
  api: { limit: 120, windowSec: 60 },
  twoFactor: { limit: 6, windowSec: 60 * 5 },
} satisfies Record<string, RateRule>;

type Bucket = { count: number; resetAt: number };
const globalStore = globalThis as unknown as { __umbraRate?: Map<string, Bucket> };
const memory = (globalStore.__umbraRate ??= new Map<string, Bucket>());

function memoryLimit(key: string, rule: RateRule): RateResult {
  const now = Date.now();
  let bucket = memory.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + rule.windowSec * 1000 };
  bucket.count++;
  memory.set(key, bucket);
  if (memory.size > 50_000) for (const [k, b] of memory) if (b.resetAt <= now) memory.delete(k);
  return bucket.count > rule.limit
    ? { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
    : { ok: true, remaining: rule.limit - bucket.count };
}

async function databaseLimit(key: string, rule: RateRule): Promise<RateResult> {
  // Upsert atômico: reinicia a janela se expirou, senão incrementa.
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, NOW() + make_interval(secs => ${rule.windowSec}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN NOW() + make_interval(secs => ${rule.windowSec}) ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0]!;
  const count = Number(row.count);
  return count > rule.limit
    ? { ok: false, retryAfter: Math.max(1, Math.ceil((new Date(row.resetAt).getTime() - Date.now()) / 1000)) }
    : { ok: true, remaining: rule.limit - count };
}

export async function rateLimit(key: string, rule: RateRule): Promise<RateResult> {
  if (env.rateLimitStore === "memory") return memoryLimit(key, rule);
  try {
    return await databaseLimit(key, rule);
  } catch (err) {
    // Falha do banco não pode derrubar login/checkout: degrada para memória.
    console.error("[rate-limit] fallback para memória", err);
    return memoryLimit(key, rule);
  }
}

/** Remove janelas expiradas (chamado pelo job periódico). */
export async function purgeRateLimits() {
  if (env.rateLimitStore !== "database") return 0;
  const { count } = await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return count;
}
