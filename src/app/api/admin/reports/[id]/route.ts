import { reportActionSchema } from "@/lib/validators";
import { apiRoute } from "@/server/http/api";
import { actOnReport } from "@/server/services/report.service";

export const PATCH = apiRoute({ auth: "moderation.manage", schema: reportActionSchema }, async ({ params, body, user, ip }) => {
  const report = await actOnReport(params.id!, body, { id: user.id, ip });
  return { report };
});
