import crypto from "node:crypto";
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
 * Mercado Pago — https://www.mercadopago.com.br/developers
 *
 * Credenciais (painel → Configurações → Pagamentos):
 *   API KEY         → Access Token (TEST-... no sandbox, APP_USR-... em produção)
 *   WEBHOOK SECRET  → "Assinatura secreta" gerada em Suas integrações → Webhooks
 * URL do webhook no Mercado Pago: {APP_URL}/api/payment/webhook
 * Eventos: Pagamentos, Planos e assinaturas.
 *
 * PIX → /v1/payments (QR Code). Cartão → /preapproval (checkout hospedado e
 * recorrente). Boleto/outros → Checkout Pro (preferência hospedada).
 *
 * ⚠ Verifique a política de uso do Mercado Pago para sua categoria antes de operar.
 */
export class MercadoPagoGateway implements PaymentGateway {
  readonly name = "mercadopago" as const;
  readonly methods: PaymentMethod[] = ["PIX", "CARD", "BOLETO", "OTHER"];
  readonly supportsRefund = true;
  readonly supportsRecurring = true;
  private base = "https://api.mercadopago.com";

  constructor(private config: PaymentConfig) {}

  private async call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    if (!this.config.apiKey) throw new GatewayError("Access Token do Mercado Pago não configurado");
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) throw new GatewayError(data.message ?? `Mercado Pago respondeu ${res.status}`, data);
    return data;
  }

  static mapStatus(s: string): PaymentStatus {
    switch (s) {
      case "approved":
        return "PAID";
      case "rejected":
        return "FAILED";
      case "cancelled":
        return "CANCELLED";
      case "refunded":
      case "charged_back":
        return "REFUNDED";
      default:
        return "PENDING"; // pending, in_process, authorized, in_mediation
    }
  }

  async testConnection() {
    try {
      const me = await this.call<{ nickname?: string }>("GET", "/users/me");
      const sandbox = this.config.apiKey.startsWith("TEST-");
      return { ok: true, message: `Conectado como ${me.nickname ?? "conta Mercado Pago"} (${sandbox ? "teste" : "produção"}).` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Falha ao conectar" };
    }
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const amount = Number((input.amountCents / 100).toFixed(2));
    const [firstName, ...rest] = input.customer.name.split(" ");

    if (input.method === "PIX") {
      const p = await this.call<{
        id: number;
        status: string;
        date_of_expiration?: string;
        point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
      }>(
        "POST",
        "/v1/payments",
        {
          transaction_amount: amount,
          description: input.description,
          payment_method_id: "pix",
          external_reference: input.paymentId,
          notification_url: input.urls.webhook,
          date_of_expiration: new Date(Date.now() + 60 * 60_000).toISOString().replace("Z", "-00:00"),
          payer: {
            email: input.customer.email,
            first_name: firstName,
            last_name: rest.join(" ") || undefined,
            identification: input.customer.cpf ? { type: "CPF", number: onlyDigits(input.customer.cpf) } : undefined,
          },
        },
        input.paymentId,
      );
      const td = p.point_of_interaction?.transaction_data;
      return {
        status: MercadoPagoGateway.mapStatus(p.status),
        gatewayPaymentId: String(p.id),
        pix: td?.qr_code
          ? {
              copyPaste: td.qr_code,
              qrBase64: td.qr_code_base64 ? `data:image/png;base64,${td.qr_code_base64}` : null,
              expiresAt: p.date_of_expiration ? new Date(p.date_of_expiration) : null,
            }
          : null,
      };
    }

    if (input.method === "CARD" && input.recurring) {
      const pre = await this.call<{ id: string; init_point: string }>("POST", "/preapproval", {
        reason: input.description,
        external_reference: input.subscriptionId,
        payer_email: input.customer.email,
        back_url: input.urls.success,
        status: "pending",
        auto_recurring: {
          frequency: input.plan.intervalMonths,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "BRL",
        },
      });
      return { status: "PENDING", gatewayPaymentId: null, gatewaySubscriptionId: pre.id, checkoutUrl: pre.init_point };
    }

    const pref = await this.call<{ id: string; init_point: string; sandbox_init_point: string }>("POST", "/checkout/preferences", {
      items: [{ id: input.plan.id, title: input.description, quantity: 1, unit_price: amount, currency_id: "BRL" }],
      payer: { email: input.customer.email, name: firstName },
      external_reference: input.paymentId,
      notification_url: input.urls.webhook,
      back_urls: { success: input.urls.success, pending: input.urls.pending, failure: input.urls.failure },
      auto_return: "approved",
    });
    return {
      status: "PENDING",
      gatewayPaymentId: null,
      checkoutUrl: this.config.apiKey.startsWith("TEST-") ? pref.sandbox_init_point : pref.init_point,
    };
  }

  async getPaymentStatus(id: string) {
    const p = await this.call<{ status: string }>("GET", `/v1/payments/${id}`);
    return MercadoPagoGateway.mapStatus(p.status);
  }

  async cancelSubscription(id: string) {
    await this.call("PUT", `/preapproval/${id}`, { status: "cancelled" });
  }

  async refund(id: string, amountCents?: number) {
    await this.call("POST", `/v1/payments/${id}/refunds`, amountCents ? { amount: amountCents / 100 } : {}, crypto.randomUUID());
    return "REFUNDED" as const;
  }

  /** Valida o header x-signature (HMAC-SHA256 do manifesto id/request-id/ts). */
  private verifySignature(req: WebhookRequest, dataId: string) {
    const secret = this.config.webhookSecret;
    const sig = req.headers.get("x-signature") ?? "";
    const requestId = req.headers.get("x-request-id") ?? "";
    if (!secret || !sig) return false;
    const parts = Object.fromEntries(sig.split(",").map((kv) => kv.trim().split("=") as [string, string]));
    if (!parts.ts || !parts.v1) return false;
    const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
    let manifest = `id:${id};`;
    if (requestId) manifest += `request-id:${requestId};`;
    manifest += `ts:${parts.ts};`;
    const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    return safeEqual(expected, parts.v1);
  }

  async parseWebhook(req: WebhookRequest): Promise<GatewayEvent[] | null> {
    const body = JSON.parse(req.rawBody || "{}") as { type?: string; action?: string; data?: { id?: string | number } };
    const type = body.type ?? req.url.searchParams.get("type") ?? req.url.searchParams.get("topic") ?? "";
    const dataId = String(req.url.searchParams.get("data.id") ?? body.data?.id ?? "");
    if (!dataId || !this.verifySignature(req, dataId)) return null;

    if (type === "payment") {
      const p = await this.call<{
        id: number;
        status: string;
        status_detail?: string;
        external_reference?: string;
        transaction_amount: number;
        metadata?: { preapproval_id?: string };
      }>("GET", `/v1/payments/${dataId}`);
      const status = MercadoPagoGateway.mapStatus(p.status);
      return [
        {
          kind: "payment",
          eventId: `payment:${p.id}:${p.status}`,
          type: `payment.${p.status}`,
          status,
          gatewayPaymentId: String(p.id),
          gatewaySubscriptionId: p.metadata?.preapproval_id ?? null,
          externalReference: p.external_reference ?? null,
          amountCents: Math.round(p.transaction_amount * 100),
          failureReason: status === "FAILED" ? (p.status_detail ?? "rejected") : null,
        },
      ];
    }

    if (type === "subscription_authorized_payment") {
      const ap = await this.call<{
        preapproval_id: string;
        transaction_amount: number;
        payment?: { id: number; status: string; status_detail?: string };
      }>("GET", `/authorized_payments/${dataId}`);
      if (!ap.payment) return [{ kind: "ignored", eventId: `ap:${dataId}`, type }];
      const status = MercadoPagoGateway.mapStatus(ap.payment.status);
      return [
        {
          kind: "payment",
          eventId: `ap:${dataId}:${ap.payment.status}`,
          type,
          status,
          gatewayPaymentId: String(ap.payment.id),
          gatewaySubscriptionId: ap.preapproval_id,
          amountCents: Math.round(ap.transaction_amount * 100),
          failureReason: status === "FAILED" ? (ap.payment.status_detail ?? "rejected") : null,
        },
      ];
    }

    if (type === "subscription_preapproval") {
      const pre = await this.call<{ id: string; status: string }>("GET", `/preapproval/${dataId}`);
      if (pre.status === "cancelled") {
        return [{ kind: "subscription_cancelled", eventId: `pre:${pre.id}:cancelled`, type, gatewaySubscriptionId: pre.id }];
      }
      return [{ kind: "ignored", eventId: `pre:${pre.id}:${pre.status}`, type }];
    }

    return [{ kind: "ignored", eventId: `${type}:${dataId}`, type }];
  }
}
