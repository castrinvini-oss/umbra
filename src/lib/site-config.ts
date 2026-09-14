// Tipos e padrões da configuração editável do site (CMS).
// Isomórfico: usado pelo servidor (render) e pelo editor visual (preview ao vivo).

export type ThemeSettings = {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  radius: number; // px, 0–28
  density: "compact" | "comfortable" | "spacious";
  cardStyle: "glass" | "solid" | "outline";
  buttonStyle: "pill" | "rounded" | "square";
};

export type IdentitySettings = {
  siteName: string;
  tagline: string;
  logoMediaId: string | null;
  faviconMediaId: string | null;
};

export type PageTexts = {
  ctaLabel: string;
  ctaLink: string;
  ctaStyle: "solid" | "outline" | "glow";
  loginLabel: string;
  benefitsTitle: string;
  benefits: string[];
  plansTitle: string;
  plansSubtitle: string;
  feedTitle: string;
  lockedLabel: string;
  unlockLabel: string;
  footerText: string;
  ageGateTitle: string;
  ageGateText: string;
};

export type BannerSettings = {
  height: "sm" | "md" | "lg";
  overlay: number; // 0–90 (%)
  position: "top" | "center" | "bottom";
  style: "full" | "contained";
  announcementEnabled: boolean;
  announcementText: string;
  announcementLink: string;
};

export type LayoutSettings = {
  feedLayout: "list" | "grid";
  showStats: boolean;
  showFeedPreview: boolean;
  showPlansOnHome: boolean;
  featuredCategoryIds: string[];
};

export type SeoSettings = {
  title: string;
  description: string;
  ogImageMediaId: string | null;
  twitterHandle: string;
  keywords: string;
};

export type SiteConfig = {
  identity: IdentitySettings;
  theme: ThemeSettings;
  texts: PageTexts;
  banner: BannerSettings;
  layout: LayoutSettings;
  seo: SeoSettings;
};

export const SITE_SECTIONS = ["identity", "theme", "texts", "banner", "layout", "seo"] as const;
export type SiteSection = (typeof SITE_SECTIONS)[number];

export const DEFAULT_SITE: SiteConfig = {
  identity: {
    siteName: "Umbra",
    tagline: "Clube privado de conteúdo exclusivo",
    logoMediaId: null,
    faviconMediaId: null,
  },
  theme: {
    primary: "#E7B77A",
    secondary: "#C86B85",
    background: "#0A090D",
    surface: "#141218",
    text: "#F2EEE7",
    muted: "#9A94A3",
    radius: 18,
    density: "comfortable",
    cardStyle: "glass",
    buttonStyle: "pill",
  },
  texts: {
    ctaLabel: "Assinar agora",
    ctaLink: "/planos",
    ctaStyle: "glow",
    loginLabel: "Entrar",
    benefitsTitle: "O que você recebe",
    benefits: [
      "Conteúdo exclusivo",
      "Novas publicações toda semana",
      "Acesso à área privada",
      "Conteúdo organizado por categorias",
      "Acesso enquanto a assinatura estiver ativa",
    ],
    plansTitle: "Escolha seu acesso",
    plansSubtitle: "Cancele quando quiser. Sem fidelidade.",
    feedTitle: "Publicações",
    lockedLabel: "Conteúdo exclusivo",
    unlockLabel: "Assine para desbloquear",
    footerText: "Conteúdo destinado exclusivamente a maiores de 18 anos.",
    ageGateTitle: "Conteúdo para maiores de 18 anos",
    ageGateText:
      "Este site contém material adulto. Ao continuar, você declara ter 18 anos ou mais e que o acesso a este tipo de conteúdo é permitido na sua localidade.",
  },
  banner: {
    height: "md",
    overlay: 45,
    position: "center",
    style: "full",
    announcementEnabled: false,
    announcementText: "",
    announcementLink: "",
  },
  layout: {
    feedLayout: "grid",
    showStats: true,
    showFeedPreview: true,
    showPlansOnHome: true,
    featuredCategoryIds: [],
  },
  seo: {
    title: "Umbra — conteúdo exclusivo",
    description: "Assine e tenha acesso ao conteúdo exclusivo e às novas publicações.",
    ogImageMediaId: null,
    twitterHandle: "",
    keywords: "",
  },
};

export function mergeSection<K extends SiteSection>(key: K, value: unknown): SiteConfig[K] {
  const base = DEFAULT_SITE[key];
  if (!value || typeof value !== "object") return base;
  return { ...base, ...(value as object) } as SiteConfig[K];
}

// ── Tema → variáveis CSS ─────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]) {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

const ch = (c: [number, number, number]) => c.join(" ");

export function themeToCssVars(theme: ThemeSettings): Record<string, string> {
  const bg = hexToRgb(theme.background);
  const surface = hexToRgb(theme.surface);
  const text = hexToRgb(theme.text);
  const primary = hexToRgb(theme.primary);
  const density = theme.density === "compact" ? 0.8 : theme.density === "spacious" ? 1.25 : 1;
  const buttonRadius =
    theme.buttonStyle === "pill" ? "999px" : theme.buttonStyle === "square" ? "4px" : `${Math.max(6, theme.radius * 0.6)}px`;
  return {
    "--c-bg": ch(bg),
    "--c-surface": ch(surface),
    "--c-surface-2": ch(mix(surface, text, 0.06)),
    "--c-line": ch(mix(bg, text, 0.12)),
    "--c-text": ch(text),
    "--c-muted": ch(hexToRgb(theme.muted)),
    "--c-primary": ch(primary),
    "--c-primary-fg": luminance(primary) > 0.45 ? "20 16 10" : "255 255 255",
    "--c-secondary": ch(hexToRgb(theme.secondary)),
    "--c-success": "74 222 128",
    "--c-warning": "250 204 21",
    "--c-danger": "248 113 113",
    "--radius": String(Math.min(28, Math.max(0, theme.radius))),
    "--density": String(density),
    "--btn-radius": buttonRadius,
  };
}

export function cssVarsToString(vars: Record<string, string>) {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}
