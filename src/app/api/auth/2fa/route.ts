import { can } from "@/lib/permissions";
import { twoFactorSchema } from "@/lib/validators";
import { createSession } from "@/server/auth/session";
import { apiRoute } from "@/server/http/api";
import { RATE_RULES } from "@/server/security/rate-limit";
import { logAdmin } from "@/server/services/audit.service";
import { completeTwoFactor } from "@/server/services/user.service";

export const POST = apiRoute({ auth: "public", schema: twoFactorSchema, rate: ["2fa", RATE_RULES.twoFactor] }, async ({ body, ip, req }) => {
  const user = await completeTwoFactor(body.challenge, body.code, ip);
  await createSession(user.id);
  const staff = can(user.role, "admin.access");
  if (staff) await logAdmin({ actorId: user.id, action: "auth.login", ip, metadata: { twoFactor: true } });
  const next = req.nextUrl.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  return { ok: true, redirect: safeNext ?? (staff ? "/admin/dashboard" : "/dashboard") };
});
