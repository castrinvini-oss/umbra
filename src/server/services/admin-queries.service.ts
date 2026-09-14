import type { Prisma } from "@prisma/client";
import { STAFF_ROLES } from "@/lib/constants";
import { parseJson } from "@/lib/utils";
import { db } from "../db";
import { ADMIN_ACTION_LABELS } from "./audit.service";

// ── CRM ──────────────────────────────────────────────────────────────────────

export async function listLeads(opts: { stage?: string | null; q?: string | null }) {
  const where: Prisma.LeadWhereInput = {};
  if (opts.stage) where.stage = opts.stage;
  if (opts.q) where.OR = [{ name: { contains: opts.q } }, { email: { contains: opts.q } }];
  const rows = await db.lead.findMany({
    where,
    include: { plan: { select: { name: true } } },
    orderBy: { lastActivityAt: "desc" },
    take: 500,
  });
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone,
    source: l.source,
    stage: l.stage,
    planName: l.plan?.name ?? null,
    potentialValueCents: l.potentialValueCents,
    lastActivity: l.lastActivity,
    lastActivityAt: l.lastActivityAt.toISOString(),
    lastInteractionAt: l.lastInteractionAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    userId: l.userId,
  }));
}

export async function getLeadDetail(id: string) {
  const lead = await db.lead.findUnique({
    where: { id },
    include: { plan: true, events: { orderBy: { createdAt: "desc" }, take: 100 }, user: { select: { id: true, status: true } } },
  });
  if (!lead) return null;
  return {
    ...lead,
    events: lead.events.map((e) => ({ ...e, metadata: parseJson(e.metadata, {}) })),
  };
}

// ── Assinantes ───────────────────────────────────────────────────────────────

export async function listSubscribers(opts: { status?: string | null; q?: string | null; planId?: string | null }) {
  const now = new Date();
  const where: Prisma.UserWhereInput = { role: "SUBSCRIBER" };
  if (opts.q) where.OR = [{ name: { contains: opts.q } }, { email: { contains: opts.q } }];
  if (opts.status === "BLOCKED") where.status = { in: ["BLOCKED", "SUSPENDED"] };
  if (opts.status === "ACTIVE") where.subscriptions = { some: { status: { in: ["ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { gt: now } } };
  if (opts.status === "INACTIVE") where.subscriptions = { none: { status: { in: ["ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { gt: now } } };
  if (opts.planId) where.subscriptions = { some: { planId: opts.planId, status: { in: ["ACTIVE", "PAST_DUE"] } } };

  const users = await db.user.findMany({
    where,
    include: {
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 3 },
      _count: { select: { payments: { where: { status: "PAID" } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return users.map((u) => {
    const current =
      u.subscriptions.find((s) => ["ACTIVE", "PAST_DUE"].includes(s.status) && s.currentPeriodEnd && s.currentPeriodEnd > now) ??
      u.subscriptions[0] ??
      null;
    const effective =
      current && ["ACTIVE", "PAST_DUE"].includes(current.status) && current.currentPeriodEnd && current.currentPeriodEnd <= now ? "EXPIRED" : current?.status;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      userStatus: u.status,
      createdAt: u.createdAt.toISOString(),
      paidCount: u._count.payments,
      subscription: current
        ? {
            id: current.id,
            status: effective ?? current.status,
            planId: current.planId,
            planName: current.plan.name,
            priceCents: current.plan.priceCents,
            intervalMonths: current.plan.intervalMonths,
            currentPeriodEnd: current.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: current.cancelAtPeriodEnd,
            gateway: current.gateway,
          }
        : null,
    };
  });
}

export async function getSubscriberDetail(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      blockedReason: true,
      createdAt: true,
      lastLoginAt: true,
      birthDate: true,
      twoFactorEnabled: true,
      subscriptions: { include: { plan: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      payments: { include: { plan: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
      lead: { include: { events: { orderBy: { createdAt: "desc" }, take: 30 } } },
    },
  });
  return user;
}

// ── Pagamentos ───────────────────────────────────────────────────────────────

export async function listPayments(opts: { status?: string | null; method?: string | null; q?: string | null }) {
  const where: Prisma.PaymentWhereInput = {};
  if (opts.status) where.status = opts.status;
  if (opts.method) where.method = opts.method;
  if (opts.q) where.OR = [{ user: { email: { contains: opts.q } } }, { user: { name: { contains: opts.q } } }, { gatewayPaymentId: { contains: opts.q } }];
  const rows = await db.payment.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } }, plan: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows.map((p) => ({
    id: p.id,
    userId: p.user.id,
    userName: p.user.name,
    userEmail: p.user.email,
    planName: p.plan.name,
    amountCents: p.amountCents,
    method: p.method,
    status: p.status,
    kind: p.kind,
    gateway: p.gateway,
    gatewayPaymentId: p.gatewayPaymentId,
    failureReason: p.failureReason,
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt?.toISOString() ?? null,
  }));
}

export async function listWebhookEvents(limit = 50) {
  return db.webhookEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, gateway: true, eventId: true, type: true, status: true, error: true, createdAt: true, processedAt: true },
  });
}

// ── Equipe e logs ────────────────────────────────────────────────────────────

export async function listTeam() {
  return db.user.findMany({
    where: { role: { in: STAFF_ROLES } },
    select: { id: true, name: true, email: true, role: true, status: true, twoFactorEnabled: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function listAdminLogs(limit = 150) {
  const rows = await db.adminLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { name: true, email: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    label: ADMIN_ACTION_LABELS[r.action] ?? r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    metadata: parseJson<Record<string, unknown>>(r.metadata, {}),
    ip: r.ip,
    actorName: r.actor?.name ?? "Sistema",
    createdAt: r.createdAt.toISOString(),
  }));
}
