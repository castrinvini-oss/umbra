import { contentSchema } from "@/lib/validators";
import { apiRoute } from "@/server/http/api";
import { logAdmin } from "@/server/services/audit.service";
import { createContent, getFeed } from "@/server/services/content.service";

/** Feed filtrado pela permissão do usuário atual (bloqueados sem URLs de mídia). */
export const GET = apiRoute({ auth: "public" }, async ({ user, req }) => {
  const sp = req.nextUrl.searchParams;
  return getFeed({
    user,
    categorySlug: sp.get("categoria"),
    cursor: sp.get("cursor"),
    limit: Number(sp.get("limit")) || 12,
    onlyUnlocked: sp.get("desbloqueados") === "1",
  });
});

export const POST = apiRoute({ auth: "content.manage", schema: contentSchema }, async ({ body, user, ip }) => {
  const content = await createContent(body, user.id);
  await logAdmin({ actorId: user.id, action: "content.create", entityType: "content", entityId: content.id, ip, metadata: { title: content.title } });
  return { content };
});
