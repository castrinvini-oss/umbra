import { NextResponse, type NextRequest } from "next/server";
import { storageFor } from "../storage";

/** Entrega um objeto do storage com suporte a Range (seek em vídeos). */
export async function streamObject(
  req: NextRequest,
  obj: { storageProvider: string; key: string; mimeType: string },
  cache: "public" | "private",
) {
  const provider = storageFor(obj.storageProvider);
  const range = req.headers.get("range");
  let parsed: { start: number; end: number } | undefined;

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const total = await provider.size(obj.key);
      let start = m[1] ? Number(m[1]) : NaN;
      let end = m[2] ? Number(m[2]) : NaN;
      if (Number.isNaN(start)) {
        start = Math.max(0, total - end);
        end = total - 1;
      } else if (Number.isNaN(end)) {
        end = Math.min(start + 2 * 1024 * 1024 - 1, total - 1); // blocos de 2 MB
      }
      if (start >= total || start > end) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
      }
      parsed = { start, end: Math.min(end, total - 1) };
    }
  }

  const result = await provider.read(obj.key, parsed);
  const headers: Record<string, string> = {
    "Content-Type": obj.mimeType,
    "Accept-Ranges": "bytes",
    "Content-Length": String(result.end - result.start + 1),
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    // s-maxage permite que a CDN da Vercel guarde mídia pública (avatar, banner…).
    "Cache-Control": cache === "public" ? "public, max-age=86400, s-maxage=604800, immutable" : "private, no-store, max-age=0",
  };
  if (cache === "private") headers["X-Robots-Tag"] = "noindex";
  if (parsed) headers["Content-Range"] = `bytes ${result.start}-${result.end}/${result.size}`;
  return new NextResponse(result.body, { status: parsed ? 206 : 200, headers });
}
