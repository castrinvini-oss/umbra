import fsp from "node:fs/promises";
import { isPublicKey, type DirectUpload, type ObjectRange, type StorageProvider } from "./types";

type SupabaseConfig = {
  url: string; // https://<project-ref>.supabase.co
  serviceKey: string; // service_role (legado) ou sb_secret_...
  privateBucket: string; // bucket PRIVADO: mídia premium
  publicBucket: string; // bucket PÚBLICO: avatar, banner, logo, capas, derivados desfocados
};

/**
 * Supabase Storage via API REST (sem SDK).
 *
 * - Chaves public/ e blur/ vão para o bucket público → URL de CDN direta.
 * - Demais chaves vão para o bucket privado → só saem por URL assinada de curta
 *   duração, emitida depois de canAccessContent().
 * - Uploads grandes vão direto do navegador ao Supabase por URL de upload
 *   assinada (escopo de um único caminho), contornando o limite da Vercel.
 *
 * A chave de serviço NUNCA vai para o navegador.
 */
export class SupabaseStorage implements StorageProvider {
  readonly name = "supabase" as const;

  constructor(private cfg: SupabaseConfig) {
    if (!cfg.url || !cfg.serviceKey) {
      throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para usar STORAGE_DRIVER=supabase");
    }
  }

  private bucketFor(key: string) {
    return isPublicKey(key) ? this.cfg.publicBucket : this.cfg.privateBucket;
  }

  private path(key: string) {
    return key.split("/").map(encodeURIComponent).join("/");
  }

  private headers(extra: Record<string, string> = {}) {
    const h: Record<string, string> = { apikey: this.cfg.serviceKey, ...extra };
    // Chaves legadas (JWT service_role) também vão no Authorization; as novas
    // sb_secret_ são aceitas apenas no header apikey.
    if (!this.cfg.serviceKey.startsWith("sb_secret_")) h.authorization = `Bearer ${this.cfg.serviceKey}`;
    return h;
  }

  private endpoint(p: string) {
    return `${this.cfg.url}/storage/v1${p}`;
  }

  private async check(res: Response, action: string) {
    if (res.ok) return;
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase Storage (${action}) respondeu ${res.status}: ${text.slice(0, 300)}`);
  }

  async putBuffer(key: string, data: Buffer, contentType: string) {
    const res = await fetch(this.endpoint(`/object/${this.bucketFor(key)}/${this.path(key)}`), {
      method: "POST",
      headers: this.headers({ "content-type": contentType, "x-upsert": "true", "cache-control": isPublicKey(key) ? "max-age=31536000" : "no-store" }),
      body: new Uint8Array(data),
    });
    await this.check(res, "upload");
  }

  async putFile(key: string, filePath: string, contentType: string) {
    await this.putBuffer(key, await fsp.readFile(filePath), contentType);
    await fsp.unlink(filePath).catch(() => {});
  }

  async delete(key: string) {
    const res = await fetch(this.endpoint(`/object/${this.bucketFor(key)}`), {
      method: "DELETE",
      headers: this.headers({ "content-type": "application/json" }),
      body: JSON.stringify({ prefixes: [key] }),
    });
    if (!res.ok && res.status !== 404) console.error("[supabase] falha ao excluir", key, res.status);
  }

  async size(key: string) {
    const res = await fetch(this.endpoint(`/object/authenticated/${this.bucketFor(key)}/${this.path(key)}`), {
      method: "HEAD",
      headers: this.headers(),
    });
    await this.check(res, "head");
    return Number(res.headers.get("content-length") ?? 0);
  }

  async read(key: string, range?: ObjectRange) {
    const res = await fetch(this.endpoint(`/object/authenticated/${this.bucketFor(key)}/${this.path(key)}`), {
      headers: this.headers(range ? { range: `bytes=${range.start}-${range.end}` } : {}),
      cache: "no-store",
    });
    await this.check(res, "download");
    const length = Number(res.headers.get("content-length") ?? 0);
    const contentRange = res.headers.get("content-range"); // bytes start-end/total
    const total = contentRange ? Number(contentRange.split("/")[1]) : length;
    const start = range && contentRange ? range.start : 0;
    return { body: res.body as ReadableStream<Uint8Array>, size: total, start, end: start + length - 1 };
  }

  async presignedUrl(key: string, ttlSeconds: number) {
    if (isPublicKey(key)) return this.publicUrl(key);
    const res = await fetch(this.endpoint(`/object/sign/${this.bucketFor(key)}/${this.path(key)}`), {
      method: "POST",
      headers: this.headers({ "content-type": "application/json" }),
      body: JSON.stringify({ expiresIn: Math.max(60, Math.round(ttlSeconds)) }),
    });
    await this.check(res, "sign");
    const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const signed = data.signedURL ?? data.signedUrl;
    if (!signed) throw new Error("Supabase Storage não retornou URL assinada");
    return signed.startsWith("http") ? signed : this.endpoint(signed);
  }

  publicUrl(key: string) {
    return isPublicKey(key) ? this.endpoint(`/object/public/${this.cfg.publicBucket}/${this.path(key)}`) : null;
  }

  async createDirectUpload(key: string, contentType: string): Promise<DirectUpload> {
    const res = await fetch(this.endpoint(`/object/upload/sign/${this.bucketFor(key)}/${this.path(key)}`), {
      method: "POST",
      headers: this.headers({ "content-type": "application/json" }),
      body: "{}",
    });
    await this.check(res, "sign upload");
    const data = (await res.json()) as { url: string };
    return {
      url: data.url.startsWith("http") ? data.url : this.endpoint(data.url),
      method: "PUT",
      headers: { "content-type": contentType, "x-upsert": "false" },
    };
  }

  /** Cria os buckets se ainda não existirem (npm run storage:setup). */
  async ensureBuckets() {
    const results: string[] = [];
    for (const [id, isPublic] of [
      [this.cfg.privateBucket, false],
      [this.cfg.publicBucket, true],
    ] as const) {
      const res = await fetch(this.endpoint("/bucket"), {
        method: "POST",
        headers: this.headers({ "content-type": "application/json" }),
        // Sem limite por bucket: vale o limite global do projeto; a aplicação aplica MAX_IMAGE_MB/MAX_VIDEO_MB.
        body: JSON.stringify({ id, name: id, public: isPublic }),
      });
      const text = await res.text();
      if (res.ok) results.push(`criado: ${id} (${isPublic ? "público" : "privado"})`);
      else if (/already exists|Duplicate/i.test(text)) results.push(`já existe: ${id}`);
      else throw new Error(`Falha ao criar bucket ${id}: ${res.status} ${text.slice(0, 200)}`);
    }
    return results;
  }
}
