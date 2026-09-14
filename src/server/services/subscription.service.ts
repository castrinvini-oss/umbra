import type { Payment, Plan, Subscription } from "@prisma/client";
import { money, date as fmtDate } from "@/lib/format";
import { addMonths } from "@/lib/utils";
import { db } from "../db";
import { sendEmail } from "../email";
import { getGateway } from "../payments";
import { logActivity } from "./audit.service";
import { advanceLead } from "./lead.service";
import { notifyStaff, notifyUser } from "./notification.service";

/**
 * Ativa ou estende a assinatura a partir de um pagamento CONFIRMADO pelo
 * gateway. Única função que concede período de acesso.
 */
export async function activateFromPayment(payment: Payment & { plan: Plan }, subscription: Subscription) {
  const now = new Date();
  const stillValid =
    ["ACTIVE", "PAST_DUE"].includes(subscription.status) && subscription.currentPeriodEnd && subscription.currentPeriodEnd > now;
  const base = stillValid ? subscription.currentPeriodEnd! : now;
  const periodEnd = addMonths(base, payment.plan.intervalMonths);
  const isRenewal = payment.kind === "RENEWAL" || !!stillValid;

  const updated = await db.subscription.update({
    where: { id: subscription.id },
    data: {
      status: "ACTIVE",
      planId: payment.planId,
      currentPeriodStart: stillValid ? subscription.currentPeriodStart : now,
      currentPeriodEnd: periodEnd,
      cancelledAt: null,
      cancelReason: null,
    },
    include: { user: true, plan: true },
  });

  // Um único acesso vigente por usuário: outras assinaturas ativas são substituídas.
  await db.subscription.updateMany({
    where: { userId: updated.userId, id: { not: updated.id }, status: { in: ["ACTIVE", "PAST_DUE", "PENDING"] } },
    data: { status: "CANCELLED", cancelledAt: now, cancelReason: "Substituída por nova assinatura", currentPeriodEnd: now },
  });

  const amount = money(payment.amountCents);
  await advanceLead(
    { userId: updated.userId },
    isRenewal ? "RENEWAL" : "CUSTOMER",
    isRenewal ? `Renovação confirmada (${amount})` : `Pagamento aprovado (${amount})`,
    { planId: payment.planId, potentialValueCents: payment.amountCents },
  );
  // Após a renovação o lead volta a "Cliente" no próximo ciclo; aqui mantemos o histórico.
  await logActivity(updated.userId, isRenewal ? "RENEWAL" : "SUBSCRIBE", `${updated.plan.name} até ${fmtDate(periodEnd)}`);
  await notifyUser(
    updated.userId,
    isRenewal ? "RENEWAL" : "PAYMENT_APPROVED",
    isRenewal ? "Assinatura renovada" : "Acesso liberado!",
    `Plano ${updated.plan.name} válido até ${fmtDate(periodEnd)}.`,
    "/conteudos",
  );
  await notifyStaff(
    isRenewal ? "RENEWAL" : "NEW_SUBSCRIPTION",
    isRenewal ? "Renovação confirmada" : "Nova assinatura",
    `${updated.user.name} · ${updated.plan.name} · ${amount}`,
    "/admin/assinantes",
  );
  await sendEmail(updated.user.email, isRenewal ? "renewal" : "paymentApproved", {
    name: updated.user.name,
    planName: updated.plan.name,
    amount,
    expiresAt: fmtDate(periodEnd),
  });
  return updated;
}

export async function cancelSubscription(
  subscriptionId: string,
  opts: { immediate: boolean; by: "user" | "admin" | "gateway"; reason?: string },
) {
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId }, include: { user: true, plan: true } });
  if (!sub) throw new Error("Assinatura não encontrada");

  if (sub.gatewaySubscriptionId && opts.by !== "gateway") {
    try {
      const { gateway } = await getGateway();
      if (gateway.name === sub.gateway) await gateway.cancelSubscription(sub.gatewaySubscriptionId);
    } catch (e) {
      console.error("[subscription] falha ao cancelar no gateway", e);
    }
  }

  const now = new Date();
  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: opts.immediate
      ? { status: "CANCELLED", cancelledAt: now, currentPeriodEnd: now, cancelAtPeriodEnd: false, cancelReason: opts.reason }
      : { cancelAtPeriodEnd: true, cancelledAt: now, cancelReason: opts.reason },
  });

  await advanceLead({ userId: sub.userId }, "CANCELLED", opts.immediate ? "Assinatura cancelada" : "Cancelamento agendado para o fim do período");
  await logActivity(sub.userId, "CANCEL", `${sub.plan.name} (${opts.by})`);
  await notifyStaff("CANCELLATION", "Cancelamento", `${sub.user.name} · ${sub.plan.name}`, "/admin/assinantes");
  await sendEmail(sub.user.email, "subscriptionCancelled", {
    name: sub.user.name,
    planName: sub.plan.name,
    expiresAt: opts.immediate ? undefined : fmtDate(sub.currentPeriodEnd),
  });
  return updated;
}

/** Concessão manual pelo admin (cortesia/suporte) — registrada em log. */
export async function grantAccess(userId: string, planId: string, months: number) {
  const plan = await db.plan.findUniqueOrThrow({ where: { id: planId } });
  const now = new Date();
  await db.subscription.updateMany({
    where: { userId, status: { in: ["ACTIVE", "PAST_DUE", "PENDING"] } },
    data: { status: "CANCELLED", cancelledAt: now, cancelReason: "Substituída por concessão manual", currentPeriodEnd: now },
  });
  const sub = await db.subscription.create({
    data: {
      userId,
      planId: plan.id,
      gateway: "manual",
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: addMonths(now, months),
    },
  });
  await advanceLead({ userId }, "CUSTOMER", `Acesso concedido manualmente (${plan.name}, ${months} mês(es))`);
  return sub;
}

export async function changePlan(subscriptionId: string, planId: string) {
  const plan = await db.plan.findUniqueOrThrow({ where: { id: planId } });
  return db.subscription.update({ where: { id: subscriptionId }, data: { planId: plan.id } });
}

// ── Job periódico ────────────────────────────────────────────────────────────

let lastRun = 0;

/** Executa no máximo a cada 10 min quando chamado de forma "preguiçosa". */
export async function maybeRunSubscriptionJob() {
  // Na Vercel o Vercel Cron cuida disso; evitar trabalho extra em renderizações.
  if (process.env.VERCEL) return;
  if (Date.now() - lastRun < 10 * 60_000) return;
  lastRun = Date.now();
  await runSubscriptionJob().catch((e) => console.error("[job] assinaturas", e));
}

/**
 * Expira períodos vencidos, finaliza cancelamentos agendados e expira
 * cobranças pendentes antigas. Agende via cron: POST /api/cron/subscriptions
 * ou `npm run cron:subscriptions`.
 */
export async function runSubscriptionJob() {
  const now = new Date();
  const ended = await db.subscription.findMany({
    where: { status: { in: ["ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { lte: now } },
    include: { user: true, plan: true },
  });
  for (const sub of ended) {
    const status = sub.cancelAtPeriodEnd ? "CANCELLED" : "EXPIRED";
    await db.subscription.update({ where: { id: sub.id }, data: { status } });
    await advanceLead({ userId: sub.userId }, "CANCELLED", status === "CANCELLED" ? "Assinatura encerrada (cancelada)" : "Assinatura expirou");
    await notifyUser(sub.userId, "CANCELLATION", "Seu acesso expirou", `Renove o plano ${sub.plan.name} para continuar.`, "/meu-plano");
  }

  const stalePayments = await db.payment.updateMany({
    where: {
      status: "PENDING",
      OR: [{ expiresAt: { lte: now } }, { expiresAt: null, createdAt: { lte: new Date(now.getTime() - 3 * 86400_000) } }],
    },
    data: { status: "EXPIRED" },
  });

  const staleSubs = await db.subscription.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lte: new Date(now.getTime() - 3 * 86400_000) },
      payments: { none: { status: { in: ["PENDING", "PAID"] } } },
    },
    data: { status: "EXPIRED" },
  });

  return { expiredSubscriptions: ended.length, expiredPayments: stalePayments.count, expiredPendingSubscriptions: staleSubs.count };
}
