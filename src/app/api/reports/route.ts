import { reportSchema } from "@/lib/validators";
import { apiRoute } from "@/server/http/api";
import { RATE_RULES } from "@/server/security/rate-limit";
import { createReport } from "@/server/services/report.service";

/** Denúncia de conteúdo — aberta a visitantes e assinantes. */
export const POST = apiRoute({ auth: "public", schema: reportSchema, rate: ["report", RATE_RULES.report] }, async ({ body, user }) => {
  await createReport({
    contentId: body.contentId,
    reason: body.reason,
    details: body.details,
    reporterId: user?.id,
    reporterEmail: user?.email ?? body.email,
  });
  return { ok: true };
});
