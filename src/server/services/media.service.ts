import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Media } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { HttpError } from "../http/api";
import { signPayload, verifyPayload } from "../security/crypto";
import { ALLOWED_DESCRIPTION, sniffFileType, type SniffResult } from "../security/file-type";
import { storage, storageFor, type StorageProvider } from "../storage";
import type { DirectUpload } from "../storage/types";

type Visibility = "PUBLIC" | "PRIVATE";

const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
const typeError = () => new HttpError(415, `Tipo de arquivo não permitido. Use ${ALLOWED_DESCRIPTION}.`);

async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch {
    return null;
  }
}

function newKey(visibility: Visibility, ext?: string) {
  const id = crypto.randomBytes(12).toString("hex");
  const now = new Date();
  const folder = visibility === "PUBLIC" ? "public" : "private";
  return { id, key: `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${id}${ext ? `.${ext}` : ""}` };
}

/**
 * Pós-processamento de imagem: valida decodificação, remove EXIF/GPS
 * (re-encode, neutraliza arquivos poliglotas) e gera o derivado desfocado
 * de 40 px usado em conteúdo bloqueado.
 */
async function processImage(input: Buffer, sniff: NonNullable<SniffResult>, visibility: Visibility, id: string, provider: StorageProvider) {
  const sharp = await loadSharp();
  if (!sharp) return { output: null as Buffer | null, width: null as number | null, height: null as number | null, blurKey: null as string | null };
  try {
    const animated = sniff.mime === "image/gif" || sniff.mime === "image/webp";
    const meta = await sharp(input, { animated }).metadata();
    let output: Buffer | null = null;
    if (["image/jpeg", "image/png", "image/webp"].includes(sniff.mime)) {
      const pipeline = sharp(input, { animated });
      if (sniff.mime === "image/jpeg") pipeline.rotate(); // aplica orientação EXIF antes de descartá-la
      const format = sniff.mime === "image/jpeg" ? "jpeg" : sniff.mime === "image/png" ? "png" : "webp";
      output = await pipeline.toFormat(format).toBuffer();
    }
    let blurKey: string | null = null;
    if (visibility === "PRIVATE") {
      const blur = await sharp(output ?? input).resize(40).blur(6).jpeg({ quality: 45 }).toBuffer();
      blurKey = `blur/${id}.jpg`;
      await provider.putBuffer(blurKey, blur, "image/jpeg");
    }
    return { output, width: meta.width ?? null, height: meta.pageHeight ?? meta.height ?? null, blurKey };
  } catch {
    throw new HttpError(415, "Imagem corrompida ou inválida");
  }
}

// ── Upload via servidor (streaming) — desenvolvimento local / servidores Node ─

/**
 * Grava em arquivo temporário respeitando o limite de tamanho e valida o tipo
 * REAL pelos primeiros bytes antes de enviar ao storage.
 * Na Vercel use o upload direto (limite de 4,5 MB por requisição).
 */
export async function ingestUpload(opts: {
  body: ReadableStream<Uint8Array> | null;
  declaredLength: number | null;
  fileName: string;
  visibility: Visibility;
  uploaderId: string;
}): Promise<Media> {
  if (!opts.body) throw new HttpError(400, "Arquivo vazio");
  const hardLimit = Math.max(env.storage.maxVideoBytes, env.storage.maxImageBytes);
  if (opts.declaredLength && opts.declaredLength > hardLimit) throw new HttpError(413, `Arquivo excede o limite de ${mb(hardLimit)} MB`);

  const tmp = path.join(os.tmpdir(), `umbra-up-${crypto.randomBytes(8).toString("hex")}`);
  const out = fs.createWriteStream(tmp);
  let size = 0;
  let head = Buffer.alloc(0);
  let sniff: SniffResult = null;
  const reader = opts.body.getReader();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (head.length < 64) {
        head = Buffer.concat([head, Buffer.from(value)]).subarray(0, 64);
        if (head.length >= 16 && !sniff) {
          sniff = sniffFileType(head);
          if (!sniff) throw typeError();
        }
      }
      const limit = sniff?.kind === "IMAGE" ? env.storage.maxImageBytes : hardLimit;
      if (size > limit) throw new HttpError(413, `Arquivo excede o limite de ${mb(limit)} MB`);
      if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    if (!sniff) sniff = sniffFileType(head);
    if (!sniff || size === 0) throw typeError();
  } catch (err) {
    reader.cancel().catch(() => {});
    out.destroy();
    await fsp.unlink(tmp).catch(() => {});
    throw err;
  }

  const provider = storage();
  const { id, key } = newKey(opts.visibility, sniff.ext);
  let meta = { width: null as number | null, height: null as number | null, blurKey: null as string | null };
  let finalSize = size;

  try {
    if (sniff.kind === "IMAGE") {
      const processed = await processImage(await fsp.readFile(tmp), sniff, opts.visibility, id, provider);
      meta = processed;
      if (processed.output) {
        await provider.putBuffer(key, processed.output, sniff.mime);
        finalSize = processed.output.length;
      } else {
        await provider.putFile(key, tmp, sniff.mime);
      }
    } else {
      await provider.putFile(key, tmp, sniff.mime);
    }
  } finally {
    await fsp.unlink(tmp).catch(() => {});
  }

  return db.media.create({
    data: {
      uploaderId: opts.uploaderId,
      kind: sniff.kind,
      visibility: opts.visibility,
      storageProvider: provider.name,
      storageKey: key,
      blurKey: meta.blurKey,
      originalName: opts.fileName.slice(0, 200),
      mimeType: sniff.mime,
      sizeBytes: finalSize,
      width: meta.width,
      height: meta.height,
    },
  });
}

// ── Upload direto (navegador → storage) — Vercel + Supabase/S3 ───────────────

type UploadTicket = { k: string; v: Visibility; u: string; n: string; p: string; i: string };

/**
 * Passo 1: valida o que o navegador declarou e devolve uma URL de upload
 * assinada, com escopo de UM caminho gerado pelo servidor, mais um "ticket"
 * assinado que amarra caminho + usuário para o passo 2.
 */
export async function prepareUpload(opts: { fileName: string; size: number; contentType: string; visibility: Visibility; uploaderId: string }) {
  const provider = storage();
  const declaredKind = opts.contentType.startsWith("image/") ? "IMAGE" : opts.contentType.startsWith("video/") ? "VIDEO" : null;
  if (!declaredKind) throw typeError();
  const limit = declaredKind === "IMAGE" ? env.storage.maxImageBytes : env.storage.maxVideoBytes;
  if (!opts.size || opts.size > limit) throw new HttpError(413, `Arquivo excede o limite de ${mb(limit)} MB`);

  const { id, key } = newKey(opts.visibility);
  const upload: DirectUpload | null = await provider.createDirectUpload(key, opts.contentType);
  if (!upload) return { mode: "proxy" as const };
  const ticket = signPayload({ k: key, v: opts.visibility, u: opts.uploaderId, n: opts.fileName.slice(0, 200), p: provider.name, i: id }, 3 * 3600);
  return { mode: "direct" as const, upload, ticket };
}

async function readHead(provider: StorageProvider, key: string) {
  const { body } = await provider.read(key, { start: 0, end: 63 });
  const reader = body.getReader();
  let head = Buffer.alloc(0);
  while (head.length < 64) {
    const { done, value } = await reader.read();
    if (done) break;
    head = Buffer.concat([head, Buffer.from(value)]);
  }
  reader.cancel().catch(() => {});
  return head.subarray(0, 64);
}

/**
 * Passo 2: depois que o navegador enviou o arquivo, o servidor inspeciona o
 * objeto no storage (tipo real pelos bytes, tamanho, decodificação de imagem).
 * Qualquer falha remove o objeto — nada inválido fica armazenado.
 */
export async function completeUpload(ticket: string, userId: string): Promise<Media> {
  const t = verifyPayload<UploadTicket>(ticket);
  if (!t || t.u !== userId) throw new HttpError(400, "Upload expirado ou inválido. Envie novamente.");
  const already = await db.media.findFirst({ where: { storageKey: t.k } });
  if (already) return already;

  const provider = storageFor(t.p);
  const fail = async (err: HttpError) => {
    await provider.delete(t.k);
    throw err;
  };

  let size: number;
  try {
    size = await provider.size(t.k);
  } catch {
    throw new HttpError(400, "Arquivo não encontrado no storage. Envie novamente.");
  }
  const sniff = sniffFileType(await readHead(provider, t.k));
  if (!sniff || size === 0) return fail(typeError());
  const limit = sniff.kind === "IMAGE" ? env.storage.maxImageBytes : env.storage.maxVideoBytes;
  if (size > limit) return fail(new HttpError(413, `Arquivo excede o limite de ${mb(limit)} MB`));

  let meta = { width: null as number | null, height: null as number | null, blurKey: null as string | null };
  let finalSize = size;
  if (sniff.kind === "IMAGE") {
    const { body } = await provider.read(t.k);
    const original = Buffer.from(await new Response(body).arrayBuffer());
    try {
      const processed = await processImage(original, sniff, t.v, t.i, provider);
      meta = processed;
      if (processed.output) {
        await provider.putBuffer(t.k, processed.output, sniff.mime); // sobrescreve sem EXIF
        finalSize = processed.output.length;
      }
    } catch (err) {
      return fail(err instanceof HttpError ? err : new HttpError(415, "Imagem inválida"));
    }
  }

  return db.media.create({
    data: {
      uploaderId: userId,
      kind: sniff.kind,
      visibility: t.v,
      storageProvider: provider.name,
      storageKey: t.k,
      blurKey: meta.blurKey,
      originalName: t.n,
      mimeType: sniff.mime,
      sizeBytes: finalSize,
      width: meta.width,
      height: meta.height,
    },
  });
}

export async function deleteMedia(id: string) {
  const media = await db.media.findUnique({ where: { id } });
  if (!media) throw new HttpError(404, "Mídia não encontrada");
  const provider = storageFor(media.storageProvider);
  await provider.delete(media.storageKey);
  if (media.blurKey) await provider.delete(media.blurKey);
  await db.media.delete({ where: { id } });
}

// ── URLs ─────────────────────────────────────────────────────────────────────

type MediaRef = Pick<Media, "id" | "visibility" | "storageKey" | "storageProvider" | "kind">;

export function publicMediaUrl(media: MediaRef | null | undefined) {
  if (!media) return null;
  if (media.visibility !== "PUBLIC") return null;
  return storageFor(media.storageProvider).publicUrl(media.storageKey) ?? `/api/media/public/${media.id}`;
}

/**
 * URL temporária e vinculada ao usuário para mídia privada. Só deve ser gerada
 * DEPOIS de canAccessContent() retornar allowed. A rota ainda revalida.
 */
export function signedMediaUrl(media: MediaRef, userId: string | null) {
  if (media.visibility === "PUBLIC") return publicMediaUrl(media);
  const ttl = media.kind === "VIDEO" ? Math.max(env.storage.signedUrlTtl, 6 * 3600) : env.storage.signedUrlTtl;
  return `/api/media/${media.id}?t=${signPayload({ m: media.id, u: userId ?? "" }, ttl)}`;
}

export function blurMediaUrl(media: Pick<Media, "id" | "blurKey" | "storageProvider">) {
  if (!media.blurKey) return null;
  return storageFor(media.storageProvider).publicUrl(media.blurKey) ?? `/api/media/blur/${media.id}`;
}

/** Resolve id → URL pública (avatar, banner, logo, OG image). */
export async function resolvePublicUrls(ids: (string | null | undefined)[]) {
  const valid = ids.filter((x): x is string => !!x);
  if (!valid.length) return new Map<string, string>();
  const rows = await db.media.findMany({ where: { id: { in: valid }, status: "READY" } });
  const map = new Map<string, string>();
  for (const m of rows) {
    const url = m.visibility === "PUBLIC" ? publicMediaUrl(m) : null;
    if (url) map.set(m.id, url);
  }
  return map;
}
