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

const BASE = "https://api.misticpay.com/api";

/**
 * MisticPay — PIX (https://docs.misticpay.com)
 *
 * Credenciais (painel → Configurações → Pagamentos):
 *   API KEY         → Client ID da chave de acesso (pk_...)
 *   SECRET KEY      → Client Secret da chave de acesso (sk_...)
 *   WEBHOOK SECRET  → token aleatório criado por você (opcional, recomendado)
 * Na MisticPay: API → Chaves de Acesso → Criar Chave de Acesso (escopo cashin).
 *
 * A URL do webhook é enviada em cada cobrança (projectWebhook), então não é
 * preciso cadastrá-la no painel da MisticPay.
 *
 * SEGURANÇA: o webhook da MisticPay não é assinado. Por isso:
 *   1. a URL carrega um token secreto (rejeita chamadas de terceiros);
 *   2. o conteúdo do webhook NUNCA é usado como verdade — o status é sempre
 *      confirmado em POST /transactions/check com as credenciais da conta.
 *
 * Limitações da API: apenas PIX, sem recorrência automática (renovação por
 * nova cobrança PIX) e sem reembolso via API (devolução pelo painel da MisticPay).
 */
export class MisticPayGateway implements PaymentGateway {
  readonly name = "misticpay" as const;
  readonly methods: PaymentMethod[] = ["PIX"];
  readonly supportsRefund = false;
  readonly supportsRecurring = false;
  readonly requiresCpf = true;

  constructor(private config: PaymentConfig) {}

  private get authHeader() {
    if (!this.config.apiKey || !this.config.secretKey) {
      throw new GatewayError("Configure o Client ID (pk_) e o Client Secret (sk_) da MisticPay");
    }
    return `Basic ${Buffer.from(`${this.config.apiKey}:${this.config.secretKey}`).toString("base64")}`;
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { authorization: this.authHeader, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
    if (!res.ok) {
      const msg = data.message ?? data.error ?? `MisticPay respondeu ${res.status}`;
      throw new GatewayError(res.status === 401 || res.status === 403 ? `Credenciais recusadas pela MisticPay: ${msg}` : msg, data);
    }
    return data;
  }

  static mapStatus(state: string | undefined): PaymentStatus {
    switch ((state ?? "").toUpperCase()) {
      case "COMPLETO":
        return "PAID";
      case "FALHA":
        return "FAILED";
      case "CANCELADO":
        return "CANCELLED";
      case "EXPIRADO":
        return "EXPIRED";
      default:
        return "PENDING";
    }
  }

  async testConnection() {
    try {
      const info = await this.call<{ data?: { name?: string; email?: string }; name?: string; email?: string }>("GET", "/users/info");
      const who = info.data?.name ?? info.data?.email ?? info.name ?? info.email;
      return { ok: true, message: `Conectado à MisticPay${who ? ` como ${who}` : ""}.` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Falha ao conectar" };
    }
  }

  private webhookUrl(base: string) {
    const url = new URL(base);
    url.searchParams.set("gateway", "misticpay");
    if (this.config.webhookSecret) url.searchParams.set("token", this.config.webhookSecret);
    return url.toString();
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    if (input.method !== "PIX") throw new GatewayError("A MisticPay aceita apenas PIX");
    const cpf = input.customer.cpf ? onlyDigits(input.customer.cpf) : "";
    if (cpf.length !== 11) throw new GatewayError("CPF do pagador é obrigatório para gerar o PIX");

    const res = await this.call<{
      data?: { transactionId?: string | number; transactionState?: string; qrCodeBase64?: string; copyPaste?: string };
    }>("POST", "/transactions/create", {
      amount: Number((input.amountCents / 100).toFixed(2)),
      payerName: input.customer.name.slice(0, 100),
      payerDocument: cpf,
      transactionId: input.paymentId,
      description: input.description.slice(0, 140),
      projectWebhook: this.webhookUrl(input.urls.webhook),
    });

    const data = res.data;
    if (!data?.transactionId || !data.copyPaste) throw new GatewayError("MisticPay não retornou o código PIX", res);
    return {
      status: MisticPayGateway.mapStatus(data.transactionState),
      gatewayPaymentId: String(data.transactionId),
      pix: {
        copyPaste: data.copyPaste,
        qrBase64: data.qrCodeBase64?.startsWith("data:") ? data.qrCodeBase64 : data.qrCodeBase64 ? `data:image/png;base64,${data.qrCodeBase64}` : null,
        expiresAt: null,
      },
    };
  }

  private async check(transactionId: string) {
    const res = await this.call<{ transaction?: { transactionId?: string | number; transactionState?: string; transactionType?: string } }>(
      "POST",
      "/transactions/check",
      { transactionId },
    );
    if (!res.transaction) throw new GatewayError("Transação não encontrada na MisticPay", res);
    return res.transaction;
  }

  async getPaymentStatus(gatewayPaymentId: string) {
    return MisticPayGateway.mapStatus((await this.check(gatewayPaymentId)).transactionState);
  }

  async cancelSubscription() {
    /* sem recorrência na MisticPay */
  }

  async refund(): Promise<PaymentStatus> {
    throw new GatewayError("A MisticPay não oferece reembolso via API. Faça a devolução pelo painel da MisticPay.");
  }

  async parseWebhook(req: WebhookRequest): Promise<GatewayEvent[] | null> {
    // 1. Token secreto na URL (quando configurado).
    if (this.config.webhookSecret) {
      const token = req.url.searchParams.get("token") ?? "";
      if (!token || !safeEqual(token, this.config.webhookSecret)) return null;
    }

    let body: {
      event?: string;
      transactionId?: string | number;
      transactionType?: string;
      status?: string;
      infraction?: { id?: string | number; status?: string; type?: string; amount?: number; transactionId?: string | number };
    };
    try {
      body = JSON.parse(req.rawBody || "{}");
    } catch {
      return null;
    }

    if (body.event === "INFRACTION" && body.infraction) {
      const inf = body.infraction;
      return [
        {
          kind: "alert",
          eventId: `misticpay:med:${inf.id}:${inf.status}`,
          type: "INFRACTION",
          title: "MED PIX aberto na MisticPay",
          message: `Infração ${inf.id ?? ""} (${inf.type ?? "?"}) · status ${inf.status ?? "?"}${inf.amount ? ` · R$ ${inf.amount}` : ""}. Responda no painel da MisticPay.`,
        },
      ];
    }

    if (!body.transactionId) return [{ kind: "ignored", eventId: `misticpay:unknown:${Date.now()}`, type: body.event ?? "unknown" }];
    if (body.transactionType && body.transactionType !== "DEPOSITO") {
      return [{ kind: "ignored", eventId: `misticpay:${body.transactionId}:${body.transactionType}:${body.status}`, type: body.transactionType }];
    }

    // 2. Confirmação autoritativa: o status vem da API, não do corpo do webhook.
    const gatewayPaymentId = String(body.transactionId);
    const tx = await this.check(gatewayPaymentId);
    const state = (tx.transactionState ?? "").toUpperCase();
    return [
      {
        kind: "payment",
        eventId: `misticpay:${gatewayPaymentId}:${state}`,
        type: `deposit.${state.toLowerCase() || "unknown"}`,
        status: MisticPayGateway.mapStatus(state),
        gatewayPaymentId,
        externalReference: null,
        amountCents: null, // valor fixado no QR dinâmico criado pelo servidor
        failureReason: state === "FALHA" ? "Transação PIX falhou na MisticPay" : null,
      },
    ];
  }
}
