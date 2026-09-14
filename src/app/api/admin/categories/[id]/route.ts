import { categorySchema } from "@/lib/validators";
import { db } from "@/server/db";
import { apiRoute } from "@/server/http/api";
import { logAdmin } from "@/server/services/audit.service";

export const PUT = apiRoute({ auth: "content.manage", schema: categorySchema }, async ({ body, params }) => {
  const category = await db.contentCategory.update({ where: { id: params.id }, data: { name: body.name, sortOrder: body.sortOrder } });
  return { category };
});

export const DELETE = apiRoute({ auth: "content.manage" }, async ({ params, user, ip }) => {
  await db.contentCategory.delete({ where: { id: params.id } });
  await logAdmin({ actorId: user.id, action: "category.delete", entityType: "category", entityId: params.id, ip });
  return { ok: true };
});
