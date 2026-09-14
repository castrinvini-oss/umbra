import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { errorResponse, getIp, verifyCsrf } from "@/server/http/api";
import { rateLimit, RATE_RULES } from "@/server/security/rate-limit";
import { logAdmin } from "@/server/services/audit.service";
import { ingestUpload, publicMediaUrl, signedMediaUrl } from "@/server/services/media.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Upload binário em streaming (corpo = arquivo) — usado com STORAGE_DRIVER=local.
 * Com Supabase/S3 o cliente usa /upload-url + /complete (upload direto).
 * Headers: x-file-name, x-visibility (PUBLIC | PRIVATE), x-csrf-token
 */
export async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) return NextResponse.json({ error: "Sessão expirada. Recarregue a página." }, { status: 403 });
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Faça login" }, { status: 401 });
    if (!can(user.role, "content.manage") && !can(user.role, "site.manage")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const ip = getIp(req);
    const limited = await rateLimit(`upload:${user.id}`, RATE_RULES.upload);
    if (!limited.ok) return NextResponse.json({ error: "Muitos uploads seguidos. Aguarde." }, { status: 429 });

    const visibility = req.headers.get("x-visibility") === "PUBLIC" ? "PUBLIC" : "PRIVATE";
    const fileName = decodeURIComponent(req.headers.get("x-file-name") ?? "arquivo").replace(/[\\/]/g, "_");
    const media = await ingestUpload({
      body: req.body,
      declaredLength: Number(req.headers.get("content-length")) || null,
      fileName,
      visibility,
      uploaderId: user.id,
    });
    await logAdmin({ actorId: user.id, action: "media.upload", entityType: "media", entityId: media.id, ip, metadata: { name: fileName, visibility } });
    return NextResponse.json({
      media: {
        id: media.id,
        kind: media.kind,
        originalName: media.originalName,
        visibility: media.visibility,
        url: visibility === "PUBLIC" ? publicMediaUrl(media) : signedMediaUrl(media, user.id),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
