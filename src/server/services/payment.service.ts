import type { PaymentMethod, PaymentStatus } from "@/lib/constants";
import { money } from "@/lib/format";
import { db } from "../db";
import { sendEmail } from "../email";
import { env } from "../env";
import { HttpError } from "../http/api";
import { buildGateway, getGateway, GatewayError, type GatewayEvent } from "../payments";
import { MockGateway } from "../payments/mock";
import { decrypt, encrypt } from "../security/crypto";
import { logAdmin } from "./audit.service";
import { addLeadEvent, advanceLead, upsertLead } from "./lead.service";
import { notifyStaff, notifyUser } from "./notification.service";
import { getPaymentConfig } from "./settings.service";
import { activateFromPayment, cancelSubscription } from "./subscription.service";

// ── Checkout ─────────────────────────────────────────────────────────────────

export async function startCheckout(input: {
  userId: string;
  planId: string;
  method: PaymentMethod;
  cpf?: string;
  kind?: "INITIAL" | "RENEWAL";
}) {
  const [user, plan] = await Promise.all([
    db.user.findUnique({ where: { id: input.userId } }),
    db.plan.findUnique({ where: { id: input.planId } }),
  ]);
  if (!user || user.status !== "ACTIVE") throw new HttpError(403, "Conta indisponível");
  if (!plan || !plan.active) throw new HttpError(404, "Plano indisponível");

  const { gateway, config } = await getGateway();
  if (!config.enabledMethods.includes(input.method) || !gateway.methods.includes(input.method)) {
    throw new HttpError(400, "Método de pagamento indisponível");
  }
  const cpf = input.cpf || decrypt(user.cpfEncrypted) || undefined;
  if (config.requireCpf && !cpf) throw new HttpError(422, "Informe o CPF", { cpf: "Obrigatório para este meio de pagamento" });
  if (input.cpf) await db.user.update({ where: { id: user.id }, data: { cpfEncrypted: encrypt(input.cpf) } });

  const kind = input.kind ?? "INITIAL";
  const active = await db.subscription.findFirst({
    where: { userId: user.id, status: { in: ["ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { gt: new Date() } },
  });
  if (kind === "INITIAL" && active?.planId === plan.id && !active.cancelAtPeriodEnd) {
    throw new HttpError(409, "Você já possui este plano ativo");
  }

  // Reaproveita cobrança pendente recente (evita PIX duplicado ao recarregar a página).
  const reusable = await db.payment.findFirst({
    where: {
      userId: user.id,
      planId: plan.id,
      method: input.method,
      status: "PENDING",
      gateway: gateway.name,
      kind,
      createdAt: { gt: new Date(Date.now() - 20 * 60_000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (reusable) return { payment: reusable, redirect: nextStepUrl(reusable) };

  const previousCustomer = await db.subscription.findFirst({
    where: { userId: user.id, gateway: gateway.name, gatewayCustomerId: { not: null } },
    select: { gatewayCustomerId: true },
  });

  const subscription =
    kind === "RENEWAL" && active
      ? active
      : await db.subscription.create({ data: { userId: user.id, planId: plan.id, gateway: gateway.name, status: "PENDING" } });

  const payment = await db.payment.create({
    data: {
      userId: user.id,
      planId: plan.id,
      subscriptionId: subscription.id,
      amountCents: plan.priceCents,
      currency: plan.currency,
      method: input.method,
      gateway: gateway.name,
      kind,
      status: "PENDING",
    },
  });

  const lead = await upsertLead({ email: user.email, name: user.name, userId: user.id, phone: user.phone, planId: plan.id });
  await advanceLead({ userId: user.id }, "CHECKOUT", `Checkout iniciado: ${plan.name} via ${input.method}`, {
    planId: plan.id,
    potentialValueCents: plan.priceCents,
  });

  try {
    const result = await gateway.createCharge({
      paymentId: payment.id,
      subscriptionId: subscription.id,
      customer: { userId: user.id, name: user.name, email: user.email, cpf, phone: user.phone, gatewayCustomerId: previousCustomer?.gatewayCustomerId },
      plan: { id: plan.id, name: plan.name, intervalMonths: plan.intervalMonths },
      amountCents: plan.priceCents,
      method: input.method,
      recurring: input.method === "CARD" && gateway.supportsRecurring && kind === "INITIAL",
      description: `Assinatura ${plan.name}`,
      urls: {
        success: `${env.appUrl}/pagamento/sucesso?id=${payment.id}`,
        pending: `${env.appUrl}/pagamento/pendente?id=${payment.id}`,
        failure: `${env.appUrl}/pagamento/erro?id=${payment.id}`,
        webhook: `${env.appUrl}/api/payment/webhook`,
      },
    });

    const updated = await db.payment.update({
      where: { id: payment.id },
      data: {
        gatewayPaymentId: result.gatewayPaymentId,
        pixCopyPaste: result.pix?.copyPaste,
        pixQrBase64: result.pix?.qrBase64,
        expiresAt: result.pix?.expiresAt ?? null,
        checkoutUrl: result.checkoutUrl,
        // O status inicial NUNCA libera acesso: confirmação só via webhook/consulta ao gateway.
        status: result.status === "PAID" ? "PENDING" : result.status,
      },
    });
    await db.subscription.update({
      where: { id: subscription.id },
      data: {
        gatewayCustomerId: result.gatewayCustomerId ?? subscription.gatewayCustomerId,
        gatewaySubscriptionId: result.gatewaySubscriptionId ?? subscription.gatewaySubscriptionId,
      },
    });

    await advanceLead({ userId: user.id }, "PAYMENT_PENDING", `Cobrança gerada (${money(plan.priceCents)})`);
    await sendEmail(user.email, "paymentPending", {
      name: user.name,
      planName: plan.name,
      amount: money(plan.priceCents),
      link: `${env.appUrl}/pagamento/pendente?id=${payment.id}`,
    });
    return { payment: updated, redirect: nextStepUrl(updated) };
  } catch (err) {
    const reason = err instanceof GatewayError ? err.message : "Falha ao comunicar com o gateway";
    console.error("[checkout]", err);
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: reason } });
    await addLeadEvent(lead.id, "PAYMENT_FAILED", `Falha ao gerar cobrança: ${reason}`);
    return { payment: { ...payment, status: "FAILED" }, redirect: `/pagamento/erro?id=${payment.id}` };
  }
}

function nextStepUrl(p: { id: string; checkoutUrl: string | null; pixCopyPaste: string | null; status: string }) {
  if (p.status === "FAILED") return `/pagamento/erro?id=${p.id}`;
  if (p.pixCopyPaste) return `/pagamento/pendente?id=${p.id}`;
  if (p.checkoutUrl) return p.checkoutUrl;
  return `/pagamento/pendente?id=${p.id}`;
}

// ── Eventos do gateway (webhook / sincronização) ─────────────────────────────

const TERMINAL_OK: PaymentStatus[] = ["PAID", "REFUNDED"];

export async function applyGatewayEvent(gatewayName: string, event: GatewayEvent): Promise<"processed" | "ignored"> {
  if (event.kind === "ignored") return "ignored";

  if (event.kind === "subscription_cancelled") {
    const sub = await db.subscription.findFirst({ where: { gateway: gatewayName, gatewaySubscriptionId: event.gatewaySubscriptionId } });
    if (!sub || sub.status === "CANCELLED") return "ignored";
    await cancelSubscription(sub.id, { immediate: false, by: "gateway", reason: "Cancelada no gateway" });
    return "processed";
  }

  // Localiza o pagamento: id do gateway → referência externa → assinatura recorrente.
  let payment =
    (event.gatewayPaymentId
      ? await db.payment.findFirst({ where: { gateway: gatewayName, gatewayPaymentId: event.gatewayPaymentId }, include: { plan: true } })
      : null) ??
    (event.externalReference
      ? await db.payment.findFirst({ where: { id: event.externalReference, gateway: gatewayName }, include: { plan: true } })
      : null);

  if (!payment) {
    const subRef = event.gatewaySubscriptionId
      ? await db.subscription.findFirst({ where: { gateway: gatewayName, gatewaySubscriptionId: event.gatewaySubscriptionId } })
      : event.externalReference
        ? await db.subscription.findFirst({ where: { id: event.externalReference, gateway: gatewayName } })
        : null;
    if (!subRef) return "ignored";
    // Cobrança gerada automaticamente pelo gateway (recorrência).
    const pendingInitial = await db.payment.findFirst({
      where: { subscriptionId: subRef.id, status: "PENDING", gatewayPaymentId: null },
      include: { plan: true },
    });
    const plan = await db.plan.findUniqueOrThrow({ where: { id: subRef.planId } });
    payment =
      pendingInitial ??
      (await db.payment.create({
        data: {
          userId: subRef.userId,
          planId: subRef.planId,
          subscriptionId: subRef.id,
          amountCents: event.amountCents ?? plan.priceCents,
          method: "CARD",
          gateway: gatewayName,
          gatewayPaymentId: event.gatewayPaymentId,
          kind: subRef.status === "PENDING" ? "INITIAL" : "RENEWAL",
          status: "PENDING",
        },
        include: { plan: true },
      }));
    if (pendingInitial && event.gatewayPaymentId) {
      payment = await db.payment.update({
        where: { id: pendingInitial.id },
        data: { gatewayPaymentId: event.gatewayPaymentId },
        include: { plan: true },
      });
    }
  }

  const previous = payment.status as PaymentStatus;
  const next = event.status;
  if (previous === next) return "ignored";
  // Não regride estados finais (ex.: webhook atrasado "pending" após "paid").
  if (TERMINAL_OK.includes(previous) && !(previous === "PAID" && next === "REFUNDED")) return "ignored";

  if (event.amountCents && next === "PAID" && event.amountCents < payment.amountCents) {
    await notifyStaff("SYSTEM", "Valor divergente no pagamento", `Pagamento ${payment.id}: esperado ${money(payment.amountCents)}, recebido ${money(event.amountCents)}`, "/admin/pagamentos");
    return "ignored";
  }

  const updated = await db.payment.update({
    where: { id: payment.id },
    data: {
      status: next,
      paidAt: next === "PAID" ? new Date() : payment.paidAt,
      refundedAt: next === "REFUNDED" ? new Date() : payment.refundedAt,
      failureReason: event.failureReason ?? payment.failureReason,
    },
    include: { plan: true, user: true },
  });

  const subscription = updated.subscriptionId ? await db.subscription.findUnique({ where: { id: updated.subscriptionId } }) : null;

  switch (next) {
    case "PAID":
      if (subscription) await activateFromPayment(updated, subscription);
      break;
    case "FAILED":
    case "EXPIRED":
    case "CANCELLED": {
      if (subscription?.status === "ACTIVE" && updated.kind === "RENEWAL") {
        await db.subscription.update({ where: { id: subscription.id }, data: { status: "PAST_DUE" } });
      }
      if (next === "FAILED") {
        await advanceLead({ userId: updated.userId }, "PAYMENT_PENDING", `Pagamento recusado (${updated.failureReason ?? "sem motivo"})`);
        await notifyStaff("PAYMENT_FAILED", "Pagamento recusado", `${updated.user.name} · ${money(updated.amountCents)}`, "/admin/pagamentos");
        await notifyUser(updated.userId, "PAYMENT_FAILED", "Pagamento não aprovado", "Tente novamente com outro método.", "/planos");
        await sendEmail(updated.user.email, "paymentFailed", {
          name: updated.user.name,
          planName: updated.plan.name,
          reason: updated.failureReason ?? undefined,
        });
      }
      break;
    }
    case "REFUNDED":
      if (subscription && ["ACTIVE", "PAST_DUE"].includes(subscription.status)) {
        await db.subscription.update({
          where: { id: subscription.id },
          data: { status: "CANCELLED", cancelledAt: new Date(), currentPeriodEnd: new Date(), cancelReason: "Pagamento reembolsado" },
        });
      }
      await advanceLead({ userId: updated.userId }, "CANCELLED", `Pagamento reembolsado (${money(updated.amountCents)})`);
      await notifyStaff("REFUND", "Reembolso confirmado", `${updated.user.name} · ${money(updated.amountCents)}`, "/admin/pagamentos");
      break;
  }
  return "processed";
}

/** Recebe o webhook bruto, valida autenticidade, garante idempotência e aplica. */
export async function processWebhook(rawBody: string, headers: Headers, url: URL) {
  const config = await getPaymentConfig();
  const requested = url.searchParams.get("gateway");
  if (requested && requested !== config.gateway) throw new HttpError(400, "Gateway não corresponde à configuração ativa");
  const gateway = buildGateway(config);

  const events = await gateway.parseWebhook({ rawBody, headers, url });
  if (!events) throw new HttpError(401, "Assinatura do webhook inválida");

  const results: { eventId: string; result: string }[] = [];
  for (const event of events) {
    const existing = await db.webhookEvent.findUnique({ where: { gateway_eventId: { gateway: gateway.name, eventId: event.eventId } } });
    if (existing && existing.status !== "FAILED") {
      results.push({ eventId: event.eventId, result: "duplicate" });
      continue;
    }
    const record =
      existing ??
      (await db.webhookEvent.create({
        data: { gateway: gateway.name, eventId: event.eventId, type: event.type, payload: rawBody.slice(0, 20_000) },
      }));
    try {
      const outcome = await applyGatewayEvent(gateway.name, event);
      await db.webhookEvent.update({
        where: { id: record.id },
        data: { status: outcome === "processed" ? "PROCESSED" : "IGNORED", processedAt: new Date(), error: null },
      });
      results.push({ eventId: event.eventId, result: outcome });
    } catch (err) {
      await db.webhookEvent.update({ where: { id: record.id }, data: { status: "FAILED", error: String(err).slice(0, 1000) } });
      throw err; // gateway reenviará
    }
  }
  return results;
}

// ── Operações administrativas ────────────────────────────────────────────────

export async function refundPayment(paymentId: string, actor: { id: string; ip?: string }) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new HttpError(404, "Pagamento não encontrado");
  if (payment.status !== "PAID") throw new HttpError(400, "Apenas pagamentos aprovados podem ser reembolsados");
  const { gateway } = await getGateway();
  if (gateway.name !== payment.gateway) throw new HttpError(400, `Este pagamento pertence ao gateway "${payment.gateway}", que não está ativo`);
  if (!gateway.supportsRefund || !payment.gatewayPaymentId) throw new HttpError(400, "Reembolso não suportado para este pagamento");

  const status = await gateway.refund(payment.gatewayPaymentId).catch((e) => {
    throw new HttpError(502, e instanceof Error ? e.message : "Falha no reembolso");
  });
  await logAdmin({ actorId: actor.id, action: "payment.refund", entityType: "payment", entityId: paymentId, ip: actor.ip });
  if (status === "REFUNDED") {
    await applyGatewayEvent(gateway.name, {
      kind: "payment",
      eventId: `refund:${paymentId}`,
      type: "refund.sync",
      status: "REFUNDED",
      gatewayPaymentId: payment.gatewayPaymentId,
      externalReference: payment.id,
    });
  }
  return status;
}

/** Consulta o status diretamente na API do gateway (reconciliação se um webhook se perder). */
export async function syncPaymentStatus(paymentId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment?.gatewayPaymentId) throw new HttpError(400, "Pagamento sem identificador no gateway");
  const { gateway } = await getGateway();
  if (gateway.name !== payment.gateway || gateway.name === "mock") return payment.status;
  const status = await gateway.getPaymentStatus(payment.gatewayPaymentId);
  await applyGatewayEvent(gateway.name, {
    kind: "payment",
    eventId: `sync:${paymentId}:${status}`,
    type: "status.sync",
    status,
    gatewayPaymentId: payment.gatewayPaymentId,
    externalReference: payment.id,
  });
  return status;
}

/**
 * MODO DEMO: dispara um webhook assinado do gateway mock pelo MESMO pipeline de
 * produção (validação de assinatura → idempotência → aplicação).
 */
export async function simulateMockWebhook(paymentId: string, status: PaymentStatus) {
  if (!env.demoMode) throw new HttpError(403, "Simulação disponível apenas em DEMO_MODE");
  const config = await getPaymentConfig();
  if (config.gateway !== "mock") throw new HttpError(400, "Simulação disponível apenas com o gateway de demonstração");
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.gateway !== "mock" || !payment.gatewayPaymentId) throw new HttpError(404, "Pagamento de demonstração não encontrado");

  const mock = new MockGateway(config);
  const { body, signature } = mock.buildWebhook(
    { id: payment.id, gatewayPaymentId: payment.gatewayPaymentId, amountCents: payment.amountCents },
    status,
  );
  const headers = new Headers({ "x-mock-signature": signature, "content-type": "application/json" });
  return processWebhook(body, headers, new URL(`${env.appUrl}/api/payment/webhook`));
}
