import { can } from "@/lib/permissions";
import { loginSchema } from "@/lib/validators";
import { createSession } from "@/server/auth/session";
import { apiRoute, HttpError } from "@/server/http/api";
import { RATE_RULES } from "@/server/security/rate-limit";
import { logAdmin } from "@/server/services/audit.service";
import { authenticate } from "@/server/services/user.service";

export const POST = apiRoute({ auth: "public", schema: loginSchema, rate: ["login", RATE_RULES.login] }, async ({ body, ip, req }) => {
  const result = await authenticate(body.email, body.password, ip);
  if (result.kind === "error") throw new HttpError(401, result.message);
  if (result.kind === "2fa") return { requires2fa: true, challenge: result.challenge };

  await createSession(result.userId);
  const staff = can(result.role, "admin.access");
  if (staff) await logAdmin({ actorId: result.userId, action: "auth.login", ip });
  const next = req.nextUrl.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  return { ok: true, redirect: safeNext ?? (staff ? "/admin/dashboard" : "/dashboard") };
});
