import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { errorResponse, verifyCsrf } from "@/server/http/api";
import { rateLimit } from "@/server/security/rate-limit";
import { completeUpload, deleteMedia, ingestUpload, prepareUpload, publicMediaUrl } from "@/server/services/media.service";

// Abaixo do limite de 4,5 MB do corpo de requisição da Vercel.
const MAX_AVATAR = 4 * 1024 * 1024;

/**
 * Foto de perfil do assinante (somente imagem, até 4 MB).
 *  - JSON { action: "prepare", size, contentType } → upload direto ao storage
 *  - JSON { action: "complete", ticket }            → valida e aplica
 *  - corpo binário                                  → upload via servidor (storage local)
 */
export async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) return NextResponse.json({ error: "Recarregue a página" }, { status: 403 });
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Faça login" }, { status: 401 });

    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = (await req.json()) as { action?: string; size?: number; contentType?: string; ticket?: string };
      if (body.action === "prepare") {
        if (!(await rateLimit(`avatar:${user.id}`, { limit: 10, windowSec: 600 })).ok) {
          return NextResponse.json({ error: "Aguarde antes de enviar outra foto" }, { status: 429 });
        }
        if (!body.contentType?.startsWith("image/") || !body.size || body.size > MAX_AVATAR) {
          return NextResponse.json({ error: "Envie uma imagem de até 4 MB" }, { status: 415 });
        }
        return NextResponse.json(await prepareUpload({ fileName: "avatar", size: body.size, contentType: body.contentType, visibility: "PUBLIC", uploaderId: user.id }));
      }
      if (body.action === "complete" && body.ticket) {
        const media = await completeUpload(body.ticket, user.id);
        return applyAvatar(user.id, user.avatarMediaId, media);
      }
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    if (!(await rateLimit(`avatar:${user.id}`, { limit: 10, windowSec: 600 })).ok) {
      return NextResponse.json({ error: "Aguarde antes de enviar outra foto" }, { status: 429 });
    }
    if (Number(req.headers.get("content-length")) > MAX_AVATAR) {
      return NextResponse.json({ error: "A foto deve ter até 4 MB" }, { status: 413 });
    }
    const media = await ingestUpload({ body: req.body, declaredLength: null, fileName: "avatar", visibility: "PUBLIC", uploaderId: user.id });
    return applyAvatar(user.id, user.avatarMediaId, media);
  } catch (err) {
    return errorResponse(err);
  }
}

async function applyAvatar(userId: string, previous: string | null, media: Awaited<ReturnType<typeof completeUpload>>) {
  if (media.kind !== "IMAGE" || media.sizeBytes > MAX_AVATAR) {
    await deleteMedia(media.id);
    return NextResponse.json({ error: "Envie uma imagem de até 4 MB" }, { status: 415 });
  }
  await db.user.update({ where: { id: userId }, data: { avatarMediaId: media.id } });
  if (previous && previous !== media.id) await deleteMedia(previous).catch(() => {});
  return NextResponse.json({ url: publicMediaUrl(media) });
}
