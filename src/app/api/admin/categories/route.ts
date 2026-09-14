import { categorySchema } from "@/lib/validators";
import { apiRoute } from "@/server/http/api";
import { logAdmin } from "@/server/services/audit.service";
import { createCategory, listCategories } from "@/server/services/content.service";

export const GET = apiRoute({ auth: "public" }, async () => ({ categories: await listCategories() }));

export const POST = apiRoute({ auth: "content.manage", schema: categorySchema }, async ({ body, user, ip }) => {
  const category = await createCategory(body.name, body.sortOrder);
  await logAdmin({ actorId: user.id, action: "category.create", entityType: "category", entityId: category.id, ip });
  return { category };
});
