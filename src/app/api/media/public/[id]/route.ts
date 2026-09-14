import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { streamObject } from "@/server/http/media-response";

/** Mídia marcada como PÚBLICA (avatar, banner, logo, capas de prévia). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await db.media.findUnique({ where: { id } });
  if (!media || media.status !== "READY" || media.visibility !== "PUBLIC") {
    return new NextResponse("Não encontrado", { status: 404 });
  }
  return streamObject(req, { storageProvider: media.storageProvider, key: media.storageKey, mimeType: media.mimeType }, "public");
}
