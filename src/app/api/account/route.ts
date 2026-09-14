import { accountUpdateSchema, changePasswordSchema } from "@/lib/validators";
import { db } from "@/server/db";
import { apiRoute, badRequest } from "@/server/http/api";
import { logActivity } from "@/server/services/audit.service";
import { changePassword } from "@/server/services/user.service";

export const PUT = apiRoute({ auth: "user", schema: accountUpdateSchema }, async ({ body, user, ip }) => {
  if (body.avatarMediaId) {
    const media = await db.media.findUnique({ where: { id: body.avatarMediaId } });
    if (!media || media.uploaderId !== user.id || media.kind !== "IMAGE") throw badRequest("Imagem inválida");
  }
  await db.user.update({
    where: { id: user.id },
    data: { name: body.name, phone: body.phone || null, avatarMediaId: body.avatarMediaId ?? undefined },
  });
  await logActivity(user.id, "PROFILE_UPDATE", "", ip);
  return { ok: true };
});

export const POST = apiRoute({ auth: "user", schema: changePasswordSchema }, async ({ body, user, ip }) => {
  await changePassword(user.id, body.currentPassword, body.newPassword);
  await logActivity(user.id, "PASSWORD_CHANGE", "", ip);
  return { ok: true };
});
