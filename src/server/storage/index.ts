import { env } from "../env";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
import { SupabaseStorage } from "./supabase";
import type { StorageProvider } from "./types";

const g = globalThis as unknown as { __umbraStorage?: Map<string, StorageProvider> };
const cache = (g.__umbraStorage ??= new Map());

/** Provedor para NOVOS uploads (definido por STORAGE_DRIVER). */
export function storage(): StorageProvider {
  const driver = env.storage.driver;
  if (driver === "local" && env.isVercel) {
    throw new Error("STORAGE_DRIVER=local não funciona na Vercel (disco efêmero). Use STORAGE_DRIVER=supabase.");
  }
  return storageFor(driver);
}

/** Provedor em que um arquivo existente foi gravado (permite migrar aos poucos). */
export function storageFor(name: string): StorageProvider {
  const existing = cache.get(name);
  if (existing) return existing;
  const cfg = env.storage;
  const provider =
    name === "supabase" ? new SupabaseStorage(cfg.supabase) : name === "s3" ? new S3Storage(cfg.s3) : new LocalStorage(cfg.localDir);
  cache.set(name, provider);
  return provider;
}

export type { StorageProvider } from "./types";
export { SupabaseStorage } from "./supabase";
