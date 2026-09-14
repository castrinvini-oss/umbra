import crypto from "node:crypto";
import { env } from "../env";

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string, key: Buffer = env.sessionSecret) {
  return crypto.createHmac("sha256", key).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** AES-256-GCM. Formato: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plain: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", env.encryptionKey, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [v, iv, tag, data] = payload.split(".");
    if (v !== "v1" || !iv || !tag || !data) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", env.encryptionKey, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Token assinado com expiração: base64url(json).assinatura */
export function signPayload(data: Record<string, unknown>, ttlSeconds: number) {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verifyPayload<T extends Record<string, unknown>>(token: string | null | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(body))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}
