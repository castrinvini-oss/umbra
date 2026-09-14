import crypto from "node:crypto";
import QRCode from "qrcode";
import type { PaymentMethod, PaymentStatus } from "@/lib/constants";
import { safeEqual } from "../security/crypto";
import type { PaymentConfig } from "../services/settings.service";
import type { CreateChargeInput, CreateChargeResult, GatewayEvent, PaymentGateway, WebhookRequest } from "./types";

/**
 * Gateway de DEMONSTRAÇÃO. Simula o ciclo real: cria cobrança pendente e só
 * confirma quando recebe um webhook assinado (HMAC) — exatamente como um
 * gateway real. Disponível apenas com DEMO_MODE=true.
 */
export class MockGateway implements PaymentGateway {
  readonly name = "mock" as const;
  readonly methods: PaymentMethod[] = ["PIX", "CARD", "BOLETO"];
  readonly supportsRefund = true;
  readonly supportsRecurring = false;

  constructor(private config: PaymentConfig) {}

  private get secret() {
    return this.config.webhookSecret || "demo-webhook-secret";
  }

  async testConnection() {
    return { ok: true, message: "Gateway de demonstração ativo. Nenhuma cobrança real será feita." };
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const gatewayPaymentId = `mock_pay_${crypto.randomBytes(8).toString("hex")}`;
    if (input.method === "PIX") {
      const copyPaste = `00020126580014BR.GOV.BCB.PIX0136demo-${input.paymentId}520400005303986540${(input.amountCents / 100).toFixed(2)}5802BR5913UMBRA DEMO6009SAO PAULO62070503***6304DEMO`;
      const qrBase64 = await QRCode.toDataURL(copyPaste, { margin: 1, width: 320, color: { dark: "#0A090D", light: "#FFFFFF" } });
      return {
        status: "PENDING",
        gatewayPaymentId,
        gatewayCustomerId: `mock_cus_${input.customer.userId}`,
        pix: { copyPaste, qrBase64, expiresAt: new Date(Date.now() + 30 * 60_000) },
      };
    }
    // Cartão/boleto: simula um checkout hospedado pelo gateway.
    return {
      status: "PENDING",
      gatewayPaymentId,
      gatewayCustomerId: `mock_cus_${input.customer.userId}`,
      checkoutUrl: `/checkout/demo/${input.paymentId}`,
    };
  }

  async getPaymentStatus(): Promise<PaymentStatus> {
    return "PENDING";
  }

  async cancelSubscription() {}

  async refund(): Promise<PaymentStatus> {
    return "REFUNDED";
  }

  sign(rawBody: string) {
    return crypto.createHmac("sha256", this.secret).update(rawBody).digest("hex");
  }

  /** Monta um webhook assinado idêntico ao que um gateway enviaria. */
  buildWebhook(payment: { gatewayPaymentId: string; id: string; amountCents: number }, status: PaymentStatus) {
    const body = JSON.stringify({
      id: `evt_${crypto.randomBytes(8).toString("hex")}`,
      type: `payment.${status.toLowerCase()}`,
      data: { paymentId: payment.gatewayPaymentId, externalReference: payment.id, status, amountCents: payment.amountCents },
      createdAt: new Date().toISOString(),
    });
    return { body, signature: this.sign(body) };
  }

  async parseWebhook(req: WebhookRequest): Promise<GatewayEvent[] | null> {
    const signature = req.headers.get("x-mock-signature") ?? "";
    if (!signature || !safeEqual(signature, this.sign(req.rawBody))) return null;
    const payload = JSON.parse(req.rawBody) as {
      id: string;
      type: string;
      data: { paymentId: string; externalReference: string; status: PaymentStatus; amountCents: number };
    };
    return [
      {
        kind: "payment",
        eventId: payload.id,
        type: payload.type,
        status: payload.data.status,
        gatewayPaymentId: payload.data.paymentId,
        externalReference: payload.data.externalReference,
        amountCents: payload.data.amountCents,
        failureReason: payload.data.status === "FAILED" ? "Recusado pelo emissor (simulação)" : null,
      },
    ];
  }
}
