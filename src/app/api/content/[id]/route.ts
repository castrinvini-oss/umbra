import { contentSchema } from "@/lib/validators";
import { db } from "@/server/db";
import { apiRoute, notFound } from "@/server/http/api";
import { canAccessContent } from "@/server/services/access.service";
import { logAdmin, logActivity } from "@/server/services/audit.service";
import { updateContent } from "@/server/services/content.service";

/** Retorna a publicação completa apenas se canAccessContent() permitir. */
export const GET = apiRoute({ auth: "public" }, async ({ params, user }) => {
  const decision = await canAccessContent(user?.id ?? null, params.id!);
  if (!decision.allowed) {
    const teaser = await db.content.findFirst({
      where: { id: params.id, status: "PUBLISHED" },
      select: { id: true, title: true, teaser: true, type: true, requiredPlan: { select: { name: true } } },
    });
    if (!teaser) throw notFound();
    return { locked: true, reason: decision.reason, content: teaser };
  }
  if (user) await logActivity(user.id, "VIEW_CONTENT", params.id!);
  const content = await db.content.findUnique({ where: { id: params.id }, include: { category: true, requiredPlan: true } });
  return { locked: false, content };
});

export const PUT = apiRoute({ auth: "content.manage", schema: contentSchema }, async ({ body, params, user, ip }) => {
  const content = await updateContent(params.id!, body, user.id);
  await logAdmin({ actorId: user.id, action: "content.update", entityType: "content", entityId: content.id, ip });
  return { content };
});

export const DELETE = apiRoute({ auth: "content.manage" }, async ({ params, user, ip }) => {
  const content = await db.content.findUnique({ where: { id: params.id } });
  if (!content) throw notFound();
  await db.content.delete({ where: { id: content.id } });
  await logAdmin({ actorId: user.id, action: "content.delete", entityType: "content", entityId: content.id, ip, metadata: { title: content.title } });
  return { ok: true };
});
