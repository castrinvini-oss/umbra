import type { Plan } from "@prisma/client";
import { parseJson, slugify } from "@/lib/utils";
import type { PlanInput } from "@/lib/validators";
import { db } from "../db";
import { HttpError } from "../http/api";

export type PlanDTO = Omit<Plan, "benefits" | "categoryIds" | "createdAt" | "updatedAt"> & {
  benefits: string[];
  categoryIds: string[];
  subscribers?: number;
};

export function toPlanDTO(p: Plan, subscribers?: number): PlanDTO {
  const { createdAt: _c, updatedAt: _u, ...rest } = p;
  return { ...rest, benefits: parseJson(p.benefits, []), categoryIds: parseJson(p.categoryIds, []), subscribers };
}

export async function listPlans(opts: { activeOnly?: boolean } = {}) {
  const rows = await db.plan.findMany({
    where: opts.activeOnly ? { active: true } : {},
    orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }],
  });
  return rows.map((p) => toPlanDTO(p));
}

export async function listPlansWithStats() {
  const rows = await db.plan.findMany({ orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }] });
  const counts = await db.subscription.groupBy({
    by: ["planId"],
    where: { status: { in: ["ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { gt: new Date() } },
    _count: true,
  });
  const map = new Map(counts.map((c) => [c.planId, c._count]));
  return rows.map((p) => toPlanDTO(p, map.get(p.id) ?? 0));
}

async function uniqueSlug(base: string, ignoreId?: string) {
  let slug = slugify(base) || "plano";
  let i = 1;
  while (await db.plan.findFirst({ where: { slug, ...(ignoreId ? { id: { not: ignoreId } } : {}) } })) {
    slug = `${slugify(base)}-${++i}`;
  }
  return slug;
}

export async function createPlan(input: PlanInput) {
  return db.plan.create({
    data: {
      ...input,
      slug: await uniqueSlug(input.slug || input.name),
      benefits: JSON.stringify(input.benefits),
      categoryIds: JSON.stringify(input.categoryIds),
    },
  });
}

export async function updatePlan(id: string, input: PlanInput) {
  const plan = await db.plan.findUnique({ where: { id } });
  if (!plan) throw new HttpError(404, "Plano não encontrado");
  return db.plan.update({
    where: { id },
    data: {
      ...input,
      slug: await uniqueSlug(input.slug || plan.slug, id),
      benefits: JSON.stringify(input.benefits),
      categoryIds: JSON.stringify(input.categoryIds),
    },
  });
}

export async function deletePlan(id: string) {
  const used = await db.subscription.count({ where: { planId: id } });
  if (used > 0) {
    throw new HttpError(409, "Este plano possui assinaturas no histórico. Desative-o em vez de excluir.");
  }
  await db.content.updateMany({ where: { requiredPlanId: id }, data: { requiredPlanId: null } });
  await db.plan.delete({ where: { id } });
}
