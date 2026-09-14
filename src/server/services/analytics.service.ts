import { LEAD_STAGES } from "@/lib/constants";
import { db } from "../db";

export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";

export function resolveRange(key: string | undefined, from?: string, to?: string) {
  const now = new Date();
  const end = new Date(now);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let start: Date;
  let range: RangeKey = (["today", "7d", "30d", "90d", "custom"].includes(key ?? "") ? key : "30d") as RangeKey;
  if (range === "custom" && from && to && !Number.isNaN(Date.parse(from)) && !Number.isNaN(Date.parse(to))) {
    start = startOfDay(new Date(from));
    const e = new Date(to);
    end.setTime(new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999).getTime());
  } else {
    if (range === "custom") range = "30d";
    const days = range === "today" ? 1 : range === "7d" ? 7 : range === "90d" ? 90 : 30;
    start = startOfDay(new Date(now.getTime() - (days - 1) * 86400_000));
  }
  const span = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - span);
  return { range, start, end, prevStart, prevEnd: start };
}

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function bucketKey(d: Date, granularity: "hour" | "day" | "week") {
  if (granularity === "hour") return `${d.getHours()}h`;
  if (granularity === "week") return localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
  return localDay(d);
}

function buildBuckets(start: Date, end: Date, granularity: "hour" | "day" | "week") {
  const keys: string[] = [];
  if (granularity === "hour") {
    for (let h = 0; h <= Math.min(23, end.getHours()); h++) keys.push(`${h}h`);
    return keys;
  }
  const step = granularity === "week" ? 7 : 1;
  const cursor = new Date(start);
  if (granularity === "week") cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  while (cursor <= end) {
    keys.push(bucketKey(cursor, granularity));
    cursor.setDate(cursor.getDate() + step);
  }
  return [...new Set(keys)];
}

const ACTIVE_WHERE = () => ({ status: { in: ["ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { gt: new Date() } });

async function periodTotals(start: Date, end: Date) {
  const [paid, leads, checkouts, cancellations] = await Promise.all([
    db.payment.findMany({ where: { status: "PAID", paidAt: { gte: start, lte: end } }, select: { amountCents: true, kind: true } }),
    db.lead.count({ where: { createdAt: { gte: start, lte: end } } }),
    db.payment.count({ where: { createdAt: { gte: start, lte: end } } }),
    db.subscription.count({ where: { cancelledAt: { gte: start, lte: end } } }),
  ]);
  const revenue = paid.reduce((s, p) => s + p.amountCents, 0);
  const newSubscribers = paid.filter((p) => p.kind === "INITIAL").length;
  return { revenue, newSubscribers, leads, checkouts, cancellations, conversion: leads ? newSubscribers / leads : 0 };
}

export async function getDashboardAnalytics(rangeKey?: string, from?: string, to?: string) {
  const r = resolveRange(rangeKey, from, to);
  const days = (r.end.getTime() - r.start.getTime()) / 86400_000;
  const granularity = r.range === "today" ? "hour" : days > 45 ? "week" : "day";

  const [current, previous, activeSubscribers, pendingPayments, payments, leads, cancels, allRevenue] = await Promise.all([
    periodTotals(r.start, r.end),
    periodTotals(r.prevStart, r.prevEnd),
    db.subscription.count({ where: ACTIVE_WHERE() }),
    db.payment.count({ where: { status: "PENDING" } }),
    db.payment.findMany({
      where: { status: "PAID", paidAt: { gte: r.start, lte: r.end } },
      select: { amountCents: true, paidAt: true, kind: true, planId: true, method: true, plan: { select: { name: true } } },
    }),
    db.lead.findMany({ where: { createdAt: { gte: r.start, lte: r.end } }, select: { createdAt: true } }),
    db.subscription.findMany({ where: { cancelledAt: { gte: r.start, lte: r.end } }, select: { cancelledAt: true } }),
    db.payment.aggregate({ where: { status: "PAID" }, _sum: { amountCents: true } }),
  ]);

  const keys = buildBuckets(r.start, r.end, granularity);
  const series = new Map(keys.map((k) => [k, { key: k, revenue: 0, subscribers: 0, cancellations: 0, leads: 0 }]));
  for (const p of payments) {
    const b = series.get(bucketKey(p.paidAt!, granularity));
    if (b) {
      b.revenue += p.amountCents;
      if (p.kind === "INITIAL") b.subscribers++;
    }
  }
  for (const l of leads) {
    const b = series.get(bucketKey(l.createdAt, granularity));
    if (b) b.leads++;
  }
  for (const c of cancels) {
    const b = series.get(bucketKey(c.cancelledAt!, granularity));
    if (b) b.cancellations++;
  }

  const planMix = new Map<string, { name: string; count: number; revenue: number }>();
  for (const p of payments) {
    const item = planMix.get(p.planId) ?? { name: p.plan.name, count: 0, revenue: 0 };
    item.count++;
    item.revenue += p.amountCents;
    planMix.set(p.planId, item);
  }

  return {
    range: r.range,
    start: r.start.toISOString(),
    end: r.end.toISOString(),
    granularity,
    kpis: {
      revenue: { value: current.revenue, previous: previous.revenue },
      revenueAllTime: allRevenue._sum.amountCents ?? 0,
      activeSubscribers: { value: activeSubscribers },
      newSubscribers: { value: current.newSubscribers, previous: previous.newSubscribers },
      newLeads: { value: current.leads, previous: previous.leads },
      conversion: { value: current.conversion, previous: previous.conversion },
      checkouts: { value: current.checkouts, previous: previous.checkouts },
      pendingPayments: { value: pendingPayments },
      cancellations: { value: current.cancellations, previous: previous.cancellations },
    },
    series: [...series.values()].map((s) => ({ ...s, conversion: s.leads ? s.subscribers / s.leads : 0 })),
    planMix: [...planMix.values()].sort((a, b) => b.count - a.count),
  };
}

export async function getCrmStats() {
  const [byStage, total, newThisWeek, revenue, activeCustomers] = await Promise.all([
    db.lead.groupBy({ by: ["stage"], _count: true }),
    db.lead.count(),
    db.lead.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } } }),
    db.payment.aggregate({ where: { status: "PAID" }, _sum: { amountCents: true } }),
    db.subscription.count({ where: ACTIVE_WHERE() }),
  ]);
  const stages = Object.fromEntries(LEAD_STAGES.map((s) => [s, 0])) as Record<(typeof LEAD_STAGES)[number], number>;
  for (const row of byStage) stages[row.stage as keyof typeof stages] = row._count;
  const customers = stages.CUSTOMER + stages.RENEWAL;
  return {
    total,
    newThisWeek,
    stages,
    activeCustomers,
    revenue: revenue._sum.amountCents ?? 0,
    conversion: total ? customers / total : 0,
  };
}

export async function getReports() {
  const now = new Date();
  const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [paid, activeSubs, cancelled30, activeAtStart, refunds] = await Promise.all([
    db.payment.findMany({
      where: { status: "PAID", paidAt: { gte: yearAgo } },
      select: { amountCents: true, paidAt: true, method: true, planId: true, userId: true, plan: { select: { name: true } } },
    }),
    db.subscription.findMany({ where: ACTIVE_WHERE(), include: { plan: true } }),
    db.subscription.count({ where: { cancelledAt: { gte: new Date(now.getTime() - 30 * 86400_000) } } }),
    db.subscription.count({
      where: { currentPeriodStart: { lte: new Date(now.getTime() - 30 * 86400_000) }, status: { in: ["ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"] } },
    }),
    db.payment.aggregate({ where: { status: "REFUNDED" }, _sum: { amountCents: true }, _count: true }),
  ]);

  const months: { key: string; label: string; revenue: number; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      revenue: 0,
      count: 0,
    });
  }
  const monthMap = new Map(months.map((m) => [m.key, m]));
  const byPlan = new Map<string, { name: string; revenue: number; count: number }>();
  const byMethod = new Map<string, { method: string; revenue: number; count: number }>();
  for (const p of paid) {
    const m = monthMap.get(`${p.paidAt!.getFullYear()}-${p.paidAt!.getMonth()}`);
    if (m) {
      m.revenue += p.amountCents;
      m.count++;
    }
    const pl = byPlan.get(p.planId) ?? { name: p.plan.name, revenue: 0, count: 0 };
    pl.revenue += p.amountCents;
    pl.count++;
    byPlan.set(p.planId, pl);
    const me = byMethod.get(p.method) ?? { method: p.method, revenue: 0, count: 0 };
    me.revenue += p.amountCents;
    me.count++;
    byMethod.set(p.method, me);
  }

  const mrr = activeSubs.reduce((s, sub) => s + Math.round(sub.plan.priceCents / sub.plan.intervalMonths), 0);
  const arpu = activeSubs.length ? mrr / activeSubs.length : 0;
  const churn = activeAtStart ? Math.min(1, cancelled30 / activeAtStart) : 0;
  const payingUsers = new Set(paid.map((p) => p.userId)).size;
  const revenue12m = paid.reduce((s, p) => s + p.amountCents, 0);

  return {
    months,
    byPlan: [...byPlan.values()].sort((a, b) => b.revenue - a.revenue),
    byMethod: [...byMethod.values()].sort((a, b) => b.revenue - a.revenue),
    mrr,
    arpu,
    churn,
    ltv: churn > 0 ? arpu / churn : arpu * 12,
    activeSubscribers: activeSubs.length,
    revenue12m,
    payingUsers,
    refunds: { amount: refunds._sum.amountCents ?? 0, count: refunds._count },
  };
}
