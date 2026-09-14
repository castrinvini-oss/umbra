import type { PaymentMethod, PaymentStatus } from "@/lib/constants";
import { onlyDigits } from "@/lib/utils";
import { safeEqual } from "../security/crypto";
import type { PaymentConfig } from "../services/settings.service";
import {
  GatewayError,
  type CreateChargeInput,
  type CreateChargeResult,
  type GatewayEvent,
  type PaymentGateway,
  type WebhookRequest,
} from "./types";

/**
 * Asaas — https://docs.asaas.com
 *
 * Credenciais (painel → Configurações → Pagamentos):
 *   API KEY         → "Chave de API" do Asaas ($aact_...)
 *   WEBHOOK SECRET  → "Token de autenticação" definido ao cadastrar o webhook
 *                     no Asaas (enviado no header `asaas-access-token`)
 * URL do webhook no Asaas: {APP_URL}/api/payment/webhook
 *
 * Cartão: usamos a fatura hospedada do Asaas (invoiceUrl) — o cliente digita o
 * cartão no ambiente do Asaas, nunca no nosso servidor.
 *
 * ⚠ Verifique com o Asaas se sua categoria de negócio é aceita antes de operar.
 */
export class AsaasGateway implements PaymentGateway {
  readonly name = "asaas" as const;
  readonly methods: PaymentMethod[] = ["PIX", "CARD", "BOLETO"];
  readonly supportsRefund = true;
  readonly supportsRecurring = true;

  constructor(private config: PaymentConfig) {}

  private get base() {
    return this.config.mode === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.config.apiKey) throw new GatewayError("API KEY do Asaas não configurada");
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "user-agent": "umbra-platform",
        access_token: this.config.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T & { errors?: { description: string }[] };
    if (!res.ok) {
      throw new GatewayError(data.errors?.[0]?.description ?? `Asaas respondeu ${res.status}`, data);
    }
    return data;
  }

  static mapStatus(s: string): PaymentStatus {
    switch (s) {
      case "RECEIVED":
      case "CONFIRMED":
      case "RECEIVED_IN_CASH":
        return "PAID";
      case "OVERDUE":
        return "EXPIRED";
      case "REFUNDED":
      case "REFUND_REQUESTED":
      case "REFUND_IN_PROGRESS":
      case "CHARGEBACK_REQUESTED":
      case "CHARGEBACK_DISPUTE":
        return "REFUNDED";
      case "DELETED":
        return "CANCELLED";
      default:
        return "PENDING";
    }
  }

  async testConnection() {
    try {
      await this.call("GET", "/customers?limit=1");
      return { ok: true, message: `Conectado ao Asaas (${this.config.mode === "production" ? "produção" : "sandbox"}).` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Falha ao conectar" };
    }
  }

  private async ensureCustomer(input: CreateChargeInput) {
    if (input.customer.gatewayCustomerId) return input.customer.gatewayCustomerId;
    const c = await this.call<{ id: string }>("POST", "/customers", {
      name: input.customer.name,
      email: input.customer.email,
      cpfCnpj: input.customer.cpf ? onlyDigits(input.customer.cpf) : undefined,
      mobilePhone: input.customer.phone ? onlyDigits(input.customer.phone) : undefined,
      externalReference: input.customer.userId,
      notificationDisabled: true,
    });
    return c.id;
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const customer = await this.ensureCustomer(input);
    const value = input.amountCents / 100;
    const today = new Date().toISOString().slice(0, 10);
    const billingType = input.method === "PIX" ? "PIX" : input.method === "BOLETO" ? "BOLETO" : "CREDIT_CARD";

    // Cartão com recorrência nativa: cria a assinatura no Asaas.
    if (input.recurring && billingType === "CREDIT_CARD") {
      const cycle = { 1: "MONTHLY", 3: "QUARTERLY", 6: "SEMIANNUALLY", 12: "YEARLY" }[input.plan.intervalMonths] ?? "MONTHLY";
      const sub = await this.call<{ id: string }>("POST", "/subscriptions", {
        customer,
        billingType,
        value,
        nextDueDate: today,
        cycle,
        description: input.description,
        externalReference: input.subscriptionId,
      });
      const payments = await this.call<{ data: { id: string; invoiceUrl: string; status: string }[] }>(
        "GET",
        `/subscriptions/${sub.id}/payments`,
      );
      const first = payments.data[0];
      return {
        status: first ? AsaasGateway.mapStatus(first.status) : "PENDING",
        gatewayPaymentId: first?.id ?? null,
        gatewayCustomerId: customer,
        gatewaySubscriptionId: sub.id,
        checkoutUrl: first?.invoiceUrl ?? null,
      };
    }

    const dueDate = new Date(Date.now() + 86400_000 * (billingType === "BOLETO" ? 3 : 1)).toISOString().slice(0, 10);
    const payment = await this.call<{ id: string; invoiceUrl: string; status: string }>("POST", "/payments", {
      customer,
      billingType,
      value,
      dueDate,
      description: input.description,
      externalReference: input.paymentId,
    });

    if (billingType === "PIX") {
      const qr = await this.call<{ encodedImage: string; payload: string; expirationDate?: string }>(
        "GET",
        `/payments/${payment.id}/pixQrCode`,
      );
      return {
        status: AsaasGateway.mapStatus(payment.status),
        gatewayPaymentId: payment.id,
        gatewayCustomerId: customer,
        pix: {
          copyPaste: qr.payload,
          qrBase64: `data:image/png;base64,${qr.encodedImage}`,
          expiresAt: qr.expirationDate ? new Date(qr.expirationDate) : null,
        },
      };
    }

    return {
      status: AsaasGateway.mapStatus(payment.status),
      gatewayPaymentId: payment.id,
      gatewayCustomerId: customer,
      checkoutUrl: payment.invoiceUrl,
    };
  }

  async getPaymentStatus(id: string) {
    const p = await this.call<{ status: string }>("GET", `/payments/${id}`);
    return AsaasGateway.mapStatus(p.status);
  }

  async cancelSubscription(id: string) {
    await this.call("DELETE", `/subscriptions/${id}`);
  }

  async refund(id: string, amountCents?: number) {
    const p = await this.call<{ status: string }>("POST", `/payments/${id}/refund`, amountCents ? { value: amountCents / 100 } : {});
    const mapped = AsaasGateway.mapStatus(p.status);
    return mapped === "PAID" ? "REFUNDED" : mapped;
  }

  async parseWebhook(req: WebhookRequest): Promise<GatewayEvent[] | null> {
    const token = req.headers.get("asaas-access-token") ?? "";
    if (!this.config.webhookSecret || !safeEqual(token, this.config.webhookSecret)) return null;

    const body = JSON.parse(req.rawBody) as {
      id?: string;
      event: string;
      payment?: { id: string; status: string; value: number; subscription?: string; externalReference?: string };
    };
    const p = body.payment;
    const eventId = body.id ?? `${body.event}:${p?.id ?? "none"}:${p?.status ?? ""}`;
    if (!p) return [{ kind: "ignored", eventId, type: body.event }];

    let status = AsaasGateway.mapStatus(p.status);
    if (["PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", "PAYMENT_REPROVED_BY_RISK_ANALYSIS"].includes(body.event)) status = "FAILED";
    if (body.event === "PAYMENT_CREATED" && status === "PENDING") return [{ kind: "ignored", eventId, type: body.event }];

    return [
      {
        kind: "payment",
        eventId,
        type: body.event,
        status,
        gatewayPaymentId: p.id,
        gatewaySubscriptionId: p.subscription ?? null,
        externalReference: p.externalReference ?? null,
        amountCents: Math.round(p.value * 100),
        failureReason: status === "FAILED" ? body.event : null,
      },
    ];
  }
}
