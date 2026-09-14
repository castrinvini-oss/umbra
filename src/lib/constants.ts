// Valores de domínio compartilhados entre servidor e cliente.

export const ROLES = ["ADMIN", "MODERATOR", "CREATOR", "SUBSCRIBER"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES: Role[] = ["ADMIN", "MODERATOR", "CREATOR"];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  MODERATOR: "Moderador",
  CREATOR: "Creator",
  SUBSCRIBER: "Assinante",
};

export const USER_STATUS = ["ACTIVE", "BLOCKED", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUS)[number];
export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Ativo",
  BLOCKED: "Bloqueado",
  SUSPENDED: "Suspenso",
};

export const PAYMENT_STATUS = ["PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED", "EXPIRED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  FAILED: "Recusado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  EXPIRED: "Expirado",
};

export const SUBSCRIPTION_STATUS = ["PENDING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];
export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  PENDING: "Aguardando pagamento",
  ACTIVE: "Ativa",
  PAST_DUE: "Em atraso",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

export const PAYMENT_METHODS = ["PIX", "CARD", "BOLETO", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: "PIX",
  CARD: "Cartão",
  BOLETO: "Boleto",
  OTHER: "Outro",
};

export const GATEWAYS = ["mock", "asaas", "mercadopago"] as const;
export type GatewayName = (typeof GATEWAYS)[number];
export const GATEWAY_LABELS: Record<GatewayName, string> = {
  mock: "Demonstração (mock)",
  asaas: "Asaas",
  mercadopago: "Mercado Pago",
};

export const CONTENT_TYPES = ["IMAGE", "VIDEO", "GALLERY", "TEXT"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  IMAGE: "Foto",
  VIDEO: "Vídeo",
  GALLERY: "Galeria",
  TEXT: "Texto",
};

export const CONTENT_STATUS = ["DRAFT", "SCHEDULED", "PUBLISHED", "REMOVED"] as const;
export type ContentStatus = (typeof CONTENT_STATUS)[number];
export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  REMOVED: "Removido",
};

export const LEAD_STAGES = [
  "NEW",
  "INTERESTED",
  "CHECKOUT",
  "PAYMENT_PENDING",
  "CUSTOMER",
  "RENEWAL",
  "CANCELLED",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  NEW: "Novo lead",
  INTERESTED: "Interessado",
  CHECKOUT: "Checkout",
  PAYMENT_PENDING: "Pagamento pendente",
  CUSTOMER: "Cliente",
  RENEWAL: "Renovação",
  CANCELLED: "Cancelado",
};

export const REPORT_REASONS = ["ILLEGAL", "UNDERAGE", "UNAUTHORIZED", "RULES", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  ILLEGAL: "Conteúdo ilegal",
  UNDERAGE: "Possível envolvimento de menor de idade",
  UNAUTHORIZED: "Conteúdo publicado sem autorização",
  RULES: "Violação de regras",
  OTHER: "Outro",
};

export const REPORT_STATUS = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"] as const;
export type ReportStatus = (typeof REPORT_STATUS)[number];
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: "Aberta",
  REVIEWING: "Em análise",
  RESOLVED: "Resolvida",
  DISMISSED: "Descartada",
};

export const INTERVAL_OPTIONS = [
  { months: 1, label: "Mensal", suffix: "/mês" },
  { months: 3, label: "Trimestral", suffix: "/trimestre" },
  { months: 6, label: "Semestral", suffix: "/semestre" },
  { months: 12, label: "Anual", suffix: "/ano" },
] as const;

export function intervalLabel(months: number) {
  return INTERVAL_OPTIONS.find((o) => o.months === months)?.label ?? `${months} meses`;
}
export function intervalSuffix(months: number) {
  return INTERVAL_OPTIONS.find((o) => o.months === months)?.suffix ?? `/${months} meses`;
}

export const MIN_AGE = 18;

export const COOKIE = {
  session: "umbra_session",
  csrf: "umbra_csrf",
  age: "umbra_age_ok",
  lead: "umbra_lead_src",
} as const;
