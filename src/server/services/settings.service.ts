import { cache } from "react";
import type { GatewayName, PaymentMethod } from "@/lib/constants";
import { DEFAULT_SITE, SITE_SECTIONS, mergeSection, type SiteConfig, type SiteSection } from "@/lib/site-config";
import { parseJson } from "@/lib/utils";
import type { PaymentConfigInput } from "@/lib/validators";
import { db } from "../db";
import { env } from "../env";
import { decrypt, encrypt } from "../security/crypto";

// ── Configuração do site (CMS) ───────────────────────────────────────────────

export const getSiteConfig = cache(async (): Promise<SiteConfig> => {
  const rows = await db.setting.findMany({ where: { key: { in: SITE_SECTIONS.map((s) => `site.${s}`) } } });
  const map = new Map(rows.map((r) => [r.key, parseJson<unknown>(r.value, null)]));
  const config = {} as SiteConfig;
  for (const section of SITE_SECTIONS) {
    (config as Record<SiteSection, unknown>)[section] = mergeSection(section, map.get(`site.${section}`));
  }
  return config;
});

export async function saveSiteSection<K extends SiteSection>(section: K, value: SiteConfig[K]) {
  const merged = { ...DEFAULT_SITE[section], ...value };
  await db.setting.upsert({
    where: { key: `site.${section}` },
    create: { key: `site.${section}`, value: JSON.stringify(merged) },
    update: { value: JSON.stringify(merged) },
  });
  return merged;
}

// ── Configuração de pagamento (credenciais criptografadas) ───────────────────

export type PaymentConfig = {
  gateway: GatewayName;
  mode: "sandbox" | "production";
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
  enabledMethods: PaymentMethod[];
  requireCpf: boolean;
  source: "panel" | "env";
};

type StoredPaymentConfig = {
  gateway: GatewayName;
  mode: "sandbox" | "production";
  apiKeyEnc?: string;
  secretKeyEnc?: string;
  webhookSecretEnc?: string;
  enabledMethods: PaymentMethod[];
  requireCpf: boolean;
};

const PAYMENT_KEY = "payment.config";

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const row = await db.setting.findUnique({ where: { key: PAYMENT_KEY } });
  const stored = parseJson<StoredPaymentConfig | null>(row?.value, null);
  if (stored) {
    return {
      gateway: stored.gateway,
      mode: stored.mode,
      apiKey: decrypt(stored.apiKeyEnc) ?? "",
      secretKey: decrypt(stored.secretKeyEnc) ?? "",
      webhookSecret: decrypt(stored.webhookSecretEnc) ?? "",
      enabledMethods: stored.enabledMethods?.length ? stored.enabledMethods : ["PIX", "CARD"],
      requireCpf: stored.requireCpf ?? false,
      source: "panel",
    };
  }
  return {
    gateway: (env.payment.gateway as GatewayName) || "mock",
    mode: env.payment.mode,
    apiKey: env.payment.apiKey,
    secretKey: env.payment.secretKey,
    webhookSecret: env.payment.webhookSecret,
    enabledMethods: ["PIX", "CARD"],
    requireCpf: false,
    source: "env",
  };
}

const mask = (v: string) => (v ? `${"•".repeat(8)}${v.slice(-4)}` : "");

/** Versão segura para o painel: segredos nunca voltam ao navegador. */
export async function getPaymentConfigMasked() {
  const c = await getPaymentConfig();
  return {
    gateway: c.gateway,
    mode: c.mode,
    enabledMethods: c.enabledMethods,
    requireCpf: c.requireCpf,
    source: c.source,
    apiKeyMask: mask(c.apiKey),
    secretKeyMask: mask(c.secretKey),
    webhookSecretMask: mask(c.webhookSecret),
  };
}

export async function savePaymentConfig(input: PaymentConfigInput) {
  const row = await db.setting.findUnique({ where: { key: PAYMENT_KEY } });
  const prev = parseJson<StoredPaymentConfig | null>(row?.value, null);
  const keep = (next: string | undefined, prevEnc: string | undefined) =>
    next && next.trim() ? encrypt(next.trim()) : prevEnc;
  const stored: StoredPaymentConfig = {
    gateway: input.gateway,
    mode: input.mode,
    enabledMethods: input.enabledMethods,
    requireCpf: input.requireCpf,
    apiKeyEnc: keep(input.apiKey, prev?.apiKeyEnc),
    secretKeyEnc: keep(input.secretKey, prev?.secretKeyEnc),
    webhookSecretEnc: keep(input.webhookSecret, prev?.webhookSecretEnc),
  };
  await db.setting.upsert({
    where: { key: PAYMENT_KEY },
    create: { key: PAYMENT_KEY, value: JSON.stringify(stored) },
    update: { value: JSON.stringify(stored) },
  });
}

// ── Flags ────────────────────────────────────────────────────────────────────

export function isDemoMode() {
  return env.demoMode;
}
