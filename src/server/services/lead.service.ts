import type { LeadStage } from "@/lib/constants";
import { LEAD_STAGE_LABELS } from "@/lib/constants";
import { db } from "../db";

const FUNNEL: LeadStage[] = ["NEW", "INTERESTED", "CHECKOUT", "PAYMENT_PENDING", "CUSTOMER"];

export async function upsertLead(input: {
  email: string;
  name: string;
  userId?: string | null;
  phone?: string | null;
  source?: string | null;
  planId?: string | null;
}) {
  const email = input.email.toLowerCase();
  const existing = await db.lead.findUnique({ where: { email } });
  if (existing) {
    return db.lead.update({
      where: { id: existing.id },
      data: {
        userId: existing.userId ?? input.userId ?? undefined,
        name: input.name || existing.name,
        phone: input.phone || existing.phone,
        planId: input.planId ?? existing.planId,
        lastActivityAt: new Date(),
      },
    });
  }
  const lead = await db.lead.create({
    data: {
      email,
      name: input.name,
      userId: input.userId ?? undefined,
      phone: input.phone || null,
      source: input.source || "direto",
      planId: input.planId ?? null,
      lastActivity: "Lead criado",
    },
  });
  await addLeadEvent(lead.id, "CREATED", `Lead criado (origem: ${lead.source})`);
  return lead;
}

export async function addLeadEvent(leadId: string, type: string, description: string, metadata: Record<string, unknown> = {}) {
  await db.$transaction([
    db.leadEvent.create({ data: { leadId, type, description, metadata: JSON.stringify(metadata) } }),
    db.lead.update({ where: { id: leadId }, data: { lastActivity: description, lastActivityAt: new Date() } }),
  ]);
}

/**
 * Transição automática de etapa. Não regride clientes para etapas anteriores
 * do funil (ex.: cliente fazendo upgrade continua "Cliente").
 */
export async function advanceLead(
  where: { userId?: string; email?: string },
  stage: LeadStage,
  description: string,
  extra: { planId?: string | null; potentialValueCents?: number; metadata?: Record<string, unknown> } = {},
) {
  const lead = where.userId
    ? await db.lead.findUnique({ where: { userId: where.userId } })
    : where.email
      ? await db.lead.findUnique({ where: { email: where.email.toLowerCase() } })
      : null;
  if (!lead) return null;

  const current = lead.stage as LeadStage;
  const isCustomer = current === "CUSTOMER" || current === "RENEWAL";
  const funnelRegress = FUNNEL.includes(stage) && FUNNEL.includes(current) && FUNNEL.indexOf(stage) < FUNNEL.indexOf(current);
  const blocked = funnelRegress || (isCustomer && ["CHECKOUT", "PAYMENT_PENDING", "INTERESTED"].includes(stage));
  const nextStage = blocked ? current : stage;

  await db.lead.update({
    where: { id: lead.id },
    data: {
      stage: nextStage,
      planId: extra.planId ?? lead.planId,
      potentialValueCents: extra.potentialValueCents ?? lead.potentialValueCents,
    },
  });
  await addLeadEvent(
    lead.id,
    nextStage !== current ? "STAGE_CHANGED" : "ACTIVITY",
    nextStage !== current ? `${description} → ${LEAD_STAGE_LABELS[nextStage]}` : description,
    extra.metadata,
  );
  return lead;
}

export async function setLeadStageManually(leadId: string, stage: LeadStage, actorName: string) {
  const lead = await db.lead.update({ where: { id: leadId }, data: { stage, lastInteractionAt: new Date() } });
  await addLeadEvent(leadId, "STAGE_CHANGED", `Etapa alterada manualmente para ${LEAD_STAGE_LABELS[stage]} por ${actorName}`);
  return lead;
}
