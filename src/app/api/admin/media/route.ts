import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { apiRoute } from "@/server/http/api";
import { blurMediaUrl, publicMediaUrl, signedMediaUrl } from "@/server/services/media.service";

/** Biblioteca de mídia (miniatura, nome, tipo, tamanho, data, status, uso). */
export const GET = apiRoute({ auth: "content.manage" }, async ({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const where: Prisma.MediaWhereInput = { status: "READY" };
  if (sp.get("kind")) where.kind = sp.get("kind")!;
  if (sp.get("visibility")) where.visibility = sp.get("visibility")!;
  if (sp.get("q")) where.OR = [{ originalName: { contains: sp.get("q")! } }, { title: { contains: sp.get("q")! } }];

  const rows = await db.media.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { _count: { select: { contents: true } } },
  });
  return {
    media: rows.map((m) => ({
      id: m.id,
      kind: m.kind,
      visibility: m.visibility,
      originalName: m.originalName,
      title: m.title,
      mimeType: m.mimeType,
      sizeBytes: m.sizeBytes,
      width: m.width,
      height: m.height,
      createdAt: m.createdAt,
      usage: m._count.contents,
      url: m.visibility === "PUBLIC" ? publicMediaUrl(m) : signedMediaUrl(m, user.id),
      blurUrl: blurMediaUrl(m),
    })),
  };
});
