import { z } from "zod";
import { can } from "@/lib/permissions";
import { apiRoute, forbidden } from "@/server/http/api";
import { logAdmin } from "@/server/services/audit.service";
import { completeUpload, publicMediaUrl, signedMediaUrl } from "@/server/services/media.service";

export const maxDuration = 60;

/** Passo 2 do upload direto: valida o objeto enviado e registra na biblioteca. */
export const POST = apiRoute({ auth: "user", schema: z.object({ ticket: z.string().min(20) }) }, async ({ body, user, ip }) => {
  if (!can(user.role, "content.manage") && !can(user.role, "site.manage")) throw forbidden();
  const media = await completeUpload(body.ticket, user.id);
  await logAdmin({ actorId: user.id, action: "media.upload", entityType: "media", entityId: media.id, ip, metadata: { name: media.originalName, visibility: media.visibility, direct: true } });
  return {
    media: {
      id: media.id,
      kind: media.kind,
      originalName: media.originalName,
      visibility: media.visibility,
      url: media.visibility === "PUBLIC" ? publicMediaUrl(media) : signedMediaUrl(media, user.id),
    },
  };
});
