import { z } from "zod";
import {
  CONTENT_STATUS,
  CONTENT_TYPES,
  GATEWAYS,
  LEAD_STAGES,
  MIN_AGE,
  PAYMENT_METHODS,
  REPORT_REASONS,
  REPORT_STATUS,
  ROLES,
} from "./constants";
import { ageFrom, isValidCpf } from "./utils";

const email = z.string().trim().toLowerCase().email("E-mail inválido").max(160);

export const passwordSchema = z
  .string()
  .min(10, "A senha deve ter pelo menos 10 caracteres")
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letras e números");

const birthDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Data inválida")
  .refine((v) => ageFrom(new Date(v)) >= MIN_AGE, `É necessário ter ${MIN_AGE} anos ou mais`)
  .refine((v) => ageFrom(new Date(v)) <= 120, "Data inválida");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80),
  email,
  password: passwordSchema,
  birthDate,
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Aceite os termos para continuar" }) }),
  confirmAdult: z.literal(true, { errorMap: () => ({ message: "Confirme que você é maior de 18 anos" }) }),
  planSlug: z.string().max(80).optional(),
  source: z.string().max(80).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha").max(128),
});

export const twoFactorSchema = z.object({
  challenge: z.string().min(10),
  code: z.string().regex(/^\d{6}$/, "Código de 6 dígitos"),
});

export const checkoutSchema = z.object({
  planId: z.string().min(1),
  method: z.enum(PAYMENT_METHODS),
  cpf: z
    .string()
    .optional()
    .refine((v) => !v || isValidCpf(v), "CPF inválido"),
  // Somente para visitantes sem conta — cria a conta no mesmo passo.
  account: registerSchema.omit({ planSlug: true }).optional(),
});

export const planSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Use letras minúsculas, números e hífen")
    .max(60)
    .optional(),
  description: z.string().max(400).default(""),
  priceCents: z.number().int().min(100, "Preço mínimo R$ 1,00").max(10_000_00),
  intervalMonths: z.number().int().refine((v) => [1, 3, 6, 12].includes(v), "Período inválido"),
  level: z.number().int().min(1).max(99),
  benefits: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  categoryIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const contentSchema = z.object({
  title: z.string().trim().min(1, "Informe um título").max(140),
  body: z.string().max(10_000).default(""),
  teaser: z.string().max(400).default(""),
  type: z.enum(CONTENT_TYPES),
  categoryId: z.string().nullable().optional(),
  requiredPlanId: z.string().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(15).default([]),
  status: z.enum(CONTENT_STATUS).default("DRAFT"),
  publishedAt: z.string().nullable().optional(),
  pinned: z.boolean().default(false),
  featured: z.boolean().default(false),
  mediaIds: z.array(z.string()).max(30).default([]),
  coverMediaId: z.string().nullable().optional(),
  consentConfirmed: z.boolean(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(40),
  sortOrder: z.number().int().default(0),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.]{3,30}$/, "3 a 30 caracteres: letras, números, _ ou ."),
  bio: z.string().max(1000).default(""),
  headline: z.string().max(120).default(""),
  location: z.string().max(60).nullable().optional(),
  verified: z.boolean().default(true),
  avatarMediaId: z.string().nullable().optional(),
  bannerMediaId: z.string().nullable().optional(),
  showSubscriberCount: z.boolean().default(true),
  socialLinks: z
    .array(z.object({ label: z.string().trim().min(1).max(30), url: z.string().trim().url("URL inválida").max(300) }))
    .max(10)
    .default([]),
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor hexadecimal (#RRGGBB)");
const safeLink = z
  .string()
  .max(300)
  .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v), "Use um caminho (/planos) ou URL https://");
const mediaRef = z.string().nullable();

export const siteSectionSchemas = {
  identity: z.object({
    siteName: z.string().trim().min(1).max(40),
    tagline: z.string().max(120),
    logoMediaId: mediaRef,
    faviconMediaId: mediaRef,
  }),
  theme: z.object({
    primary: hex,
    secondary: hex,
    background: hex,
    surface: hex,
    text: hex,
    muted: hex,
    radius: z.number().int().min(0).max(28),
    density: z.enum(["compact", "comfortable", "spacious"]),
    cardStyle: z.enum(["glass", "solid", "outline"]),
    buttonStyle: z.enum(["pill", "rounded", "square"]),
  }),
  texts: z.object({
    ctaLabel: z.string().trim().min(1).max(40),
    ctaLink: safeLink,
    ctaStyle: z.enum(["solid", "outline", "glow"]),
    loginLabel: z.string().trim().min(1).max(30),
    benefitsTitle: z.string().max(80),
    benefits: z.array(z.string().trim().min(1).max(120)).max(12),
    plansTitle: z.string().max(80),
    plansSubtitle: z.string().max(160),
    feedTitle: z.string().max(60),
    lockedLabel: z.string().trim().min(1).max(40),
    unlockLabel: z.string().trim().min(1).max(40),
    footerText: z.string().max(300),
    ageGateTitle: z.string().trim().min(1).max(80),
    ageGateText: z.string().trim().min(1).max(600),
  }),
  banner: z.object({
    height: z.enum(["sm", "md", "lg"]),
    overlay: z.number().int().min(0).max(90),
    position: z.enum(["top", "center", "bottom"]),
    style: z.enum(["full", "contained"]),
    announcementEnabled: z.boolean(),
    announcementText: z.string().max(140),
    announcementLink: safeLink,
  }),
  layout: z.object({
    feedLayout: z.enum(["list", "grid"]),
    showStats: z.boolean(),
    showFeedPreview: z.boolean(),
    showPlansOnHome: z.boolean(),
    featuredCategoryIds: z.array(z.string()).max(10),
  }),
  seo: z.object({
    title: z.string().trim().min(1).max(70),
    description: z.string().max(170),
    ogImageMediaId: mediaRef,
    twitterHandle: z.string().max(30),
    keywords: z.string().max(200),
  }),
};

export const paymentConfigSchema = z.object({
  gateway: z.enum(GATEWAYS),
  mode: z.enum(["sandbox", "production"]),
  apiKey: z.string().max(500).optional(), // vazio/ausente = manter valor salvo
  secretKey: z.string().max(500).optional(),
  webhookSecret: z.string().max(500).optional(),
  enabledMethods: z.array(z.enum(PAYMENT_METHODS)).min(1),
  requireCpf: z.boolean(),
});

export const reportSchema = z.object({
  contentId: z.string().optional(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(2000).default(""),
  email: email.optional().or(z.literal("")),
});

export const reportActionSchema = z.object({
  status: z.enum(REPORT_STATUS).optional(),
  resolution: z.string().max(1000).optional(),
  removeContent: z.boolean().optional(),
  suspendUser: z.boolean().optional(),
});

export const leadUpdateSchema = z.object({
  stage: z.enum(LEAD_STAGES).optional(),
  notes: z.string().max(5000).optional(),
  phone: z.string().max(20).optional(),
  note: z.string().trim().max(1000).optional(), // adiciona interação ao histórico
});

export const subscriberActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("block"), reason: z.string().max(300).optional() }),
  z.object({ action: z.literal("unblock") }),
  z.object({ action: z.literal("cancel"), immediate: z.boolean().default(false) }),
  z.object({ action: z.literal("changePlan"), planId: z.string().min(1) }),
  z.object({ action: z.literal("grant"), planId: z.string().min(1), months: z.number().int().min(1).max(24) }),
]);

export const teamMemberSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password: passwordSchema,
  role: z.enum(ROLES).refine((r) => r !== "SUBSCRIBER", "Use cadastro normal para assinantes"),
});

export const accountUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  avatarMediaId: z.string().nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({ token: z.string().min(20), password: passwordSchema });

export type RegisterInput = z.infer<typeof registerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type PlanInput = z.infer<typeof planSchema>;
export type ContentInput = z.infer<typeof contentSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type PaymentConfigInput = z.infer<typeof paymentConfigSchema>;
