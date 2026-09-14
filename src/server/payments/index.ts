import type { GatewayName } from "@/lib/constants";
import { env } from "../env";
import { getPaymentConfig, type PaymentConfig } from "../services/settings.service";
import { AsaasGateway } from "./asaas";
import { MercadoPagoGateway } from "./mercadopago";
import { MisticPayGateway } from "./misticpay";
import { MockGateway } from "./mock";
import { GatewayError, type PaymentGateway } from "./types";

/**
 * Registro de gateways. Para adicionar um novo:
 *   1. crie src/server/payments/<nome>.ts implementando PaymentGateway
 *   2. adicione o nome em GATEWAYS (src/lib/constants.ts)
 *   3. registre abaixo
 */
const REGISTRY: Record<GatewayName, (c: PaymentConfig) => PaymentGateway> = {
  mock: (c) => new MockGateway(c),
  misticpay: (c) => new MisticPayGateway(c),
  asaas: (c) => new AsaasGateway(c),
  mercadopago: (c) => new MercadoPagoGateway(c),
};

export function buildGateway(config: PaymentConfig): PaymentGateway {
  if (config.gateway === "mock" && !env.demoMode) {
    throw new GatewayError("O gateway de demonstração só funciona com DEMO_MODE=true. Configure um gateway real.");
  }
  const factory = REGISTRY[config.gateway];
  if (!factory) throw new GatewayError(`Gateway desconhecido: ${config.gateway}`);
  return factory(config);
}

export async function getGateway() {
  const config = await getPaymentConfig();
  return { gateway: buildGateway(config), config };
}

export * from "./types";
