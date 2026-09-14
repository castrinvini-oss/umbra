import { leadUpdateSchema } from "@/lib/validators";
import { db } from "@/server/db";
import { apiRoute, notFound } from "@/server/http/api";
import { getLeadDetail } from "@/server/services/admin-queries.service";
import { logAdmin } from "@/server/services/audit.service";
import { addLeadEvent, setLeadStageManually } from "@/server/services/lead.service";

export const GET = apiRoute({ auth: "leads.manage" }, async ({ params }) => {
  const lead = await getLeadDetail(params.id!);
  if (!lead) throw notFound("Lead não encontrado");
  return { lead };
});

export const PATCH = apiRoute({ auth: "leads.manage", schema: leadUpdateSchema }, async ({ params, body, user, ip }) => {
  const lead = await db.lead.findUnique({ where: { id: params.id } });
  if (!lead) throw notFound("Lead não encontrado");
  if (body.stage && body.stage !== lead.stage) await setLeadStageManually(lead.id, body.stage, user.name);
  if (body.notes !== undefined || body.phone !== undefined) {
    await db.lead.update({ where: { id: lead.id }, data: { notes: body.notes ?? lead.notes, phone: body.phone ?? lead.phone } });
  }
  if (body.note) {
    await addLeadEvent(lead.id, "NOTE", body.note, { by: user.name });
    await db.lead.update({ where: { id: lead.id }, data: { lastInteractionAt: new Date() } });
  }
  await logAdmin({ actorId: user.id, action: "lead.update", entityType: "lead", entityId: lead.id, ip, metadata: { stage: body.stage } });
  return { lead: await getLeadDetail(lead.id) };
});
