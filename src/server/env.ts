import crypto from "node:crypto";

// Leitura tardia (getters): scripts como o seed podem carregar o .env depois
// dos imports sem que valores fiquem congelados com os padrões.

const str = (name: string, fallback = "") => (process.env[name] ?? fallback).trim();
const isProd = () => process.env.NODE_ENV === "production";

function devSecret(name: string, bytes: number) {
  // Em desenvolvimento geramos um segredo determinístico para não travar o
  // primeiro `npm run dev`. Em produção a variável é obrigatória.
  if (isProd()) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return crypto.createHash("sha256").update(`umbra-dev-only:${name}`).digest().subarray(0, bytes);
}

let warned = false;
function warnOnce() {
  if (!warned && !isProd()) {
    warned = true;
    console.warn("[umbra] SESSION_SECRET/ENCRYPTION_KEY ausentes — usando segredos de desenvolvimento. Configure o .env antes de publicar.");
  }
}

export type StorageDriver = "local" | "s3" | "supabase";

export const env = {
  get isProd() {
    return isProd();
  },
  /** Executando na Vercel (sistema de arquivos efêmero, limite de 4,5 MB por requisição). */
  get isVercel() {
    return !!process.env.VERCEL;
  },
  get appUrl() {
    const explicit = str("APP_URL");
    if (explicit) return explicit.replace(/\/$/, "");
    const vercel = str("VERCEL_PROJECT_PRODUCTION_URL") || str("VERCEL_URL");
    return vercel ? `https://${vercel}` : "http://localhost:3000";
  },
  get demoMode() {
    return str("DEMO_MODE", "true") === "true";
  },

  get sessionSecret(): Buffer {
    const v = str("SESSION_SECRET");
    if (v.length >= 32 && !v.startsWith("troque")) return Buffer.from(v);
    if (isProd()) throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres aleatórios");
    warnOnce();
    return devSecret("SESSION_SECRET", 32);
  },
  get encryptionKey(): Buffer {
    const v = str("ENCRYPTION_KEY");
    if (v) {
      const key = Buffer.from(v, "base64");
      if (key.length !== 32) throw new Error("ENCRYPTION_KEY deve ter 32 bytes em base64");
      return key;
    }
    warnOnce();
    return devSecret("ENCRYPTION_KEY", 32);
  },
  get sessionTtlDays() {
    return Number(str("SESSION_TTL_DAYS", "14")) || 14;
  },
  get cronSecret() {
    return str("CRON_SECRET");
  },
  /** "database" compartilha contadores entre instâncias serverless; "memory" só serve para 1 processo. */
  get rateLimitStore(): "database" | "memory" {
    const v = str("RATE_LIMIT_STORE");
    if (v === "memory" || v === "database") return v;
    return isProd() ? "database" : "memory";
  },

  get storage() {
    return {
      driver: str("STORAGE_DRIVER", "local") as StorageDriver,
      localDir: str("STORAGE_LOCAL_DIR", "./storage"),
      s3: {
        endpoint: str("S3_ENDPOINT") || undefined,
        region: str("S3_REGION", "auto"),
        bucket: str("S3_BUCKET"),
        accessKeyId: str("S3_ACCESS_KEY_ID"),
        secretAccessKey: str("S3_SECRET_ACCESS_KEY"),
        forcePathStyle: str("S3_FORCE_PATH_STYLE") === "true",
        publicCdnUrl: str("S3_PUBLIC_CDN_URL").replace(/\/$/, ""),
      },
      supabase: {
        url: str("SUPABASE_URL").replace(/\/$/, ""),
        serviceKey: str("SUPABASE_SERVICE_ROLE_KEY"),
        privateBucket: str("SUPABASE_PRIVATE_BUCKET", "umbra-private"),
        publicBucket: str("SUPABASE_PUBLIC_BUCKET", "umbra-public"),
      },
      maxImageBytes: (Number(str("MAX_IMAGE_MB", "20")) || 20) * 1024 * 1024,
      maxVideoBytes: (Number(str("MAX_VIDEO_MB", "1024")) || 1024) * 1024 * 1024,
      signedUrlTtl: Number(str("SIGNED_URL_TTL_SECONDS", "900")) || 900,
    };
  },

  get payment() {
    return {
      gateway: str("PAYMENT_GATEWAY", "mock"),
      mode: str("PAYMENT_MODE", "sandbox") as "sandbox" | "production",
      apiKey: str("PAYMENT_API_KEY"),
      secretKey: str("PAYMENT_SECRET_KEY"),
      webhookSecret: str("PAYMENT_WEBHOOK_SECRET", "demo-webhook-secret"),
    };
  },

  get email() {
    return {
      driver: str("EMAIL_DRIVER", "console") as "console" | "smtp",
      from: str("EMAIL_FROM", "Umbra <nao-responda@exemplo.com>"),
      smtp: {
        host: str("SMTP_HOST"),
        port: Number(str("SMTP_PORT", "587")),
        secure: str("SMTP_SECURE") === "true",
        user: str("SMTP_USER"),
        pass: str("SMTP_PASS"),
      },
    };
  },
};
