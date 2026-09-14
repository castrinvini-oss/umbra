import { SiteEditor } from "@/components/admin/site-editor";
import { requirePermission } from "@/server/auth/guards";
import { getSiteEditorData } from "@/server/services/site-editor.service";

export const metadata = { title: "Perfil público" };

export default async function AdminProfilePage() {
  await requirePermission("site.manage");
  const data = await getSiteEditorData();
  return (
    <SiteEditor
      data={data}
      panels={["profile", "social", "texts", "benefits", "seo", "identity"]}
      eyebrow="Site"
      title="Perfil público"
      description="Foto, banner, bio, links, textos da página, benefícios e SEO — sem tocar em código."
    />
  );
}
