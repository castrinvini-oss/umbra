import { requirePermission } from "@/server/auth/guards";
import { listAdminContent, listCategories } from "@/server/services/content.service";
import { listPlans } from "@/server/services/plan.service";
import { ContentManager } from "./content-manager";

export const metadata = { title: "Conteúdos" };

export default async function AdminContentPage() {
  const user = await requirePermission("content.manage");
  const [contents, categories, plans] = await Promise.all([listAdminContent({ viewerId: user.id }), listCategories(), listPlans()]);
  return (
    <ContentManager
      contents={contents}
      categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, sortOrder: c.sortOrder }))}
      plans={plans.map((p) => ({ id: p.id, name: p.name, level: p.level }))}
    />
  );
}
