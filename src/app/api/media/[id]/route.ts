import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { streamObject } from "@/server/http/media-response";
import { verifyPayload } from "@/server/security/crypto";
import { canAccessMedia } from "@/server/services/access.service";
import { storageFor } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Entrega de mídia PRIVADA. Exige, cumulativamente:
 *   1. URL assinada válida e não expirada, emitida para ESTE usuário
 *   2. sessão do mesmo usuário (visitante anônimo apenas para publicações gratuitas)
 *   3. canAccessMedia → canAccessContent (assinatura válida, plano compatível, conteúdo ativo)
 * Com S3, redireciona para uma URL pré-assinada de curta duração.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = verifyPayload<{ m: string; u: string }>(req.nextUrl.searchParams.get("t"));
  const user = await getCurrentUser();
  const deny = () => new NextResponse("Acesso negado", { status: 403, headers: { "Cache-Control": "no-store" } });

  // A URL é vinculada ao usuário para quem foi emitida ("" = visitante, só conteúdo gratuito).
  if (!token || token.m !== id || token.u !== (user?.id ?? "")) return deny();
  if (!(await canAccessMedia(user, id))) return deny();

  const media = await db.media.findUnique({ where: { id } });
  if (!media || media.status !== "READY") return new NextResponse("Não encontrado", { status: 404 });

  const provider = storageFor(media.storageProvider);
  const presigned = await provider.presignedUrl(media.storageKey, Math.min(env.storage.signedUrlTtl, 3600), media.mimeType);
  if (presigned) return NextResponse.redirect(presigned, { status: 302, headers: { "Cache-Control": "no-store" } });

  return streamObject(req, { storageProvider: media.storageProvider, key: media.storageKey, mimeType: media.mimeType }, "private");
}
