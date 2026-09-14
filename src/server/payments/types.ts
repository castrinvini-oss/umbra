import type { GatewayName, PaymentMethod, PaymentStatus } from "@/lib/constants";

export type ChargeCustomer = {
  userId: string;
  name: string;
  email: string;
  cpf?: string | null;
  phone?: string | null;
  gatewayCustomerId?: string | null;
};

export type CreateChargeInput = {
  paymentId: string; // id interno (external_reference no gateway)
  subscriptionId: string;
  customer: ChargeCustomer;
  plan: { id: string; name: string; intervalMonths: number };
  amountCents: number;
  method: PaymentMethod;
  /** true = tentar cobrança recorrente nativa do gateway (ex.: cartão). */
  recurring: boolean;
  description: string;
  urls: { success: string; pending: string; failure: string; webhook: string };
};

export type CreateChargeResult = {
  status: PaymentStatus;
  gatewayPaymentId: string | null;
  gatewayCustomerId?: string | null;
  gatewaySubscriptionId?: string | null;
  pix?: { copyPaste: string; qrBase64?: string | null; expiresAt?: Date | null } | null;
  /** Checkout hospedado pelo gateway (dados do cartão NUNCA passam pelo nosso servidor). */
  checkoutUrl?: string | null;
};

/** Evento normalizado — independente do formato de cada gateway. */
export type GatewayEvent =
  | {
      kind: "payment";
      eventId: string;
      type: string;
      status: PaymentStatus;
      gatewayPaymentId: string | null;
      gatewaySubscriptionId?: string | null;
      externalReference?: string | null; // nosso Payment.id (ou Subscription.id)
      amountCents?: number | null;
      failureReason?: string | null;
    }
  | {
      kind: "subscription_cancelled";
      eventId: string;
      type: string;
      gatewaySubscriptionId: string;
    }
  | { kind: "ignored"; eventId: string; type: string }
  /** Aviso para a equipe (ex.: MED/infração aberta), sem alterar pagamentos. */
  | { kind: "alert"; eventId: string; type: string; title: string; message: string };

export type WebhookRequest = { rawBody: string; headers: Headers; url: URL };

/**
 * Contrato único de gateway. Para integrar um novo provedor (Pagar.me, CCBill,
 * Segpay, Efí...), implemente esta interface em src/server/payments/<nome>.ts e
 * registre-o em src/server/payments/index.ts. Nenhuma outra parte do sistema
 * precisa mudar.
 */
export interface PaymentGateway {
  readonly name: GatewayName;
  readonly methods: PaymentMethod[];
  readonly supportsRefund: boolean;
  readonly supportsRecurring: boolean;
  /** O gateway exige CPF do pagador para gerar a cobrança. */
  readonly requiresCpf?: boolean;

  testConnection(): Promise<{ ok: boolean; message: string }>;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatus>;
  cancelSubscription(gatewaySubscriptionId: string): Promise<void>;
  refund(gatewayPaymentId: string, amountCents?: number): Promise<PaymentStatus>;
  /** Retorna null quando a assinatura/autenticidade do webhook é inválida. */
  parseWebhook(req: WebhookRequest): Promise<GatewayEvent[] | null>;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
