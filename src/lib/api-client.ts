"use client";

import { COOKIE } from "./constants";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string>,
    public data?: unknown,
  ) {
    super(message);
  }
}

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : "";
}

async function ensureCsrf() {
  let token = readCookie(COOKIE.csrf);
  if (!token) {
    await fetch("/api/auth/csrf", { credentials: "same-origin" });
    token = readCookie(COOKIE.csrf);
  }
  return token;
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; raw?: BodyInit; headers?: Record<string, string> };

export async function api<T = unknown>(url: string, opts: Options = {}): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (method !== "GET" && method !== "HEAD") headers["x-csrf-token"] = await ensureCsrf();
  let body: BodyInit | undefined = opts.raw;
  if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, { ...opts, method, headers, body, credentials: "same-origin" });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; fields?: Record<string, string> };
    throw new ApiClientError(d.error ?? "Algo deu errado. Tente novamente.", res.status, d.fields, data);
  }
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

type UploadedMedia = { media: { id: string; kind: string; url: string | null; originalName: string } };
type DirectPlan = { mode: "direct"; ticket: string; upload: { url: string; method: "PUT"; headers: Record<string, string> } } | { mode: "proxy" };

/** Envio com progresso (XHR permite acompanhar o upload). */
function sendWithProgress(opts: {
  url: string;
  method: string;
  headers: Record<string, string>;
  file: File;
  onProgress?: (pct: number) => void;
  parse?: boolean;
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method, opts.url);
    for (const [k, v] of Object.entries(opts.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const data = opts.parse === false ? {} : safeJson(xhr.responseText || "{}");
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiClientError((data as { error?: string; message?: string }).error ?? (data as { message?: string }).message ?? "Falha no upload", xhr.status));
    };
    xhr.onerror = () => reject(new ApiClientError("Falha de rede no upload", 0));
    xhr.send(opts.file);
  });
}

/**
 * Upload de mídia. Com Supabase/S3 o arquivo vai DIRETO do navegador ao storage
 * por URL assinada (sem o limite de 4,5 MB da Vercel) e o servidor valida em
 * seguida. Com storage local, o arquivo é enviado em streaming à aplicação.
 */
export async function uploadFile(
  file: File,
  opts: { visibility: "PUBLIC" | "PRIVATE"; onProgress?: (pct: number) => void },
): Promise<UploadedMedia> {
  const plan = await api<DirectPlan>("/api/admin/media/upload-url", {
    method: "POST",
    body: { fileName: file.name, size: file.size, contentType: file.type || "application/octet-stream", visibility: opts.visibility },
  });

  if (plan.mode === "direct") {
    await sendWithProgress({ url: plan.upload.url, method: plan.upload.method, headers: plan.upload.headers, file, onProgress: (p) => opts.onProgress?.(Math.min(p, 97)) });
    const done = await api<UploadedMedia>("/api/admin/media/complete", { method: "POST", body: { ticket: plan.ticket } });
    opts.onProgress?.(100);
    return done;
  }

  const csrf = await ensureCsrf();
  return (await sendWithProgress({
    url: "/api/admin/media/upload",
    method: "POST",
    headers: {
      "x-csrf-token": csrf,
      "content-type": file.type || "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name),
      "x-visibility": opts.visibility,
    },
    file,
    onProgress: opts.onProgress,
  })) as UploadedMedia;
}

/** Foto de perfil do assinante (mesma estratégia: direto ao storage quando disponível). */
export async function uploadAvatar(file: File): Promise<{ url: string }> {
  const plan = await api<DirectPlan>("/api/account/avatar", { method: "POST", body: { action: "prepare", size: file.size, contentType: file.type } });
  if (plan.mode === "direct") {
    await sendWithProgress({ url: plan.upload.url, method: plan.upload.method, headers: plan.upload.headers, file });
    return api<{ url: string }>("/api/account/avatar", { method: "POST", body: { action: "complete", ticket: plan.ticket } });
  }
  const csrf = await ensureCsrf();
  return (await sendWithProgress({ url: "/api/account/avatar", method: "POST", headers: { "x-csrf-token": csrf, "content-type": file.type }, file })) as { url: string };
}
