import { cookies } from "next/headers";
import { COOKIE } from "@/lib/constants";
import { registerSchema } from "@/lib/validators";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { apiRoute } from "@/server/http/api";
import { RATE_RULES } from "@/server/security/rate-limit";
import { registerUser } from "@/server/services/user.service";

export const POST = apiRoute({ auth: "public", schema: registerSchema, rate: ["register", RATE_RULES.register] }, async ({ body }) => {
  const plan = body.planSlug ? await db.plan.findFirst({ where: { slug: body.planSlug, active: true } }) : null;
  const source = body.source || (await cookies()).get(COOKIE.lead)?.value || "direto";
  const user = await registerUser({ ...body, source, planId: plan?.id });
  await createSession(user.id);
  return { ok: true, redirect: plan ? `/checkout?plano=${plan.slug}` : "/planos" };
});
