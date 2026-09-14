// Detecção de tipo real pelo conteúdo (magic bytes) — protege contra MIME
// spoofing: o Content-Type e a extensão enviados pelo navegador são ignorados.

export type SniffResult = { mime: string; kind: "IMAGE" | "VIDEO"; ext: string } | null;

export function sniffFileType(head: Buffer): SniffResult {
  const b = head;
  const at = (i: number, bytes: number[]) => bytes.every((v, k) => b[i + k] === v);
  const ascii = (i: number, s: string) => b.subarray(i, i + s.length).toString("latin1") === s;

  if (at(0, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", kind: "IMAGE", ext: "jpg" };
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", kind: "IMAGE", ext: "png" };
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return { mime: "image/gif", kind: "IMAGE", ext: "gif" };
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return { mime: "image/webp", kind: "IMAGE", ext: "webp" };

  if (ascii(4, "ftyp")) {
    const brand = b.subarray(8, 12).toString("latin1");
    if (["avif", "avis"].includes(brand)) return { mime: "image/avif", kind: "IMAGE", ext: "avif" };
    if (["heic", "heix", "mif1"].includes(brand)) return null; // HEIC não é exibível na maioria dos navegadores
    if (brand === "qt  ") return { mime: "video/quicktime", kind: "VIDEO", ext: "mov" };
    return { mime: "video/mp4", kind: "VIDEO", ext: "mp4" };
  }
  if (at(0, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: "video/webm", kind: "VIDEO", ext: "webm" };

  return null;
}

export const ALLOWED_DESCRIPTION = "JPG, PNG, WEBP, GIF, AVIF, MP4, MOV ou WEBM";
