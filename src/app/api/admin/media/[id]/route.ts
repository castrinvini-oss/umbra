import { z } from "zod";
import { db } from "@/server/db";
import { apiRoute, HttpError, notFound } from "@/server/http/api";
import { logAdmin } from "@/server/services/audit.service";
import { deleteMedia } from "@/server/services/media.service";

export const PATCH = apiRoute(
  { auth: "content.manage", schema: z.object({ title: z.string().max(120).nullable() }) },
  async ({ params, body }) => {
    const media = await db.media.update({ where: { id: params.id }, data: { title: body.title } }).catch(() => null);
    if (!media) throw notFound();
    return { ok: true };
  },
);

export const DELETE = apiRoute({ auth: "content.manage" }, async ({ params, user, ip, req }) => {
  const id = params.id!;
  const force = req.nextUrl.searchParams.get("force") === "1";
  const usage = await db.contentMedia.count({ where: { mediaId: id } });
  const refs = await db.profile.count({ where: { OR: [{ avatarMediaId: id }, { bannerMediaId: id }] } });
  if ((usage > 0 || refs > 0) && !force) {
    throw new HttpError(409, `Mídia em uso (${usage} publicação(ões)${refs ? ", perfil" : ""}). Confirme para excluir mesmo assim.`);
  }
  if (refs) await db.profile.updateMany({ where: { avatarMediaId: id }, data: { avatarMediaId: null } });
  if (refs) await db.profile.updateMany({ where: { bannerMediaId: id }, data: { bannerMediaId: null } });
  await deleteMedia(id);
  await logAdmin({ actorId: user.id, action: "media.delete", entityType: "media", entityId: id, ip });
  return { ok: true };
});
