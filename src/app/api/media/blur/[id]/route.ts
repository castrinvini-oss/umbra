import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { streamObject } from "@/server/http/media-response";

/**
 * Derivado desfocado (40px, blur) usado como fundo de conteúdo bloqueado.
 * Não permite reconstruir o original — o arquivo premium nunca é enviado.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await db.media.findUnique({ where: { id }, select: { blurKey: true, status: true, storageProvider: true } });
  if (!media?.blurKey || media.status !== "READY") return new NextResponse("Não encontrado", { status: 404 });
  return streamObject(req, { storageProvider: media.storageProvider, key: media.blurKey, mimeType: "image/jpeg" }, "public");
}
