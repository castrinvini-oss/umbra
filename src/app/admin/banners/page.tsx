import { SiteEditor } from "@/components/admin/site-editor";
import { requirePermission } from "@/server/auth/guards";
import { getSiteEditorData } from "@/server/services/site-editor.service";

export const metadata = { title: "Banners" };

export default async function AdminBannersPage() {
  await requirePermission("site.manage");
  const data = await getSiteEditorData();
  return (
    <SiteEditor
      data={data}
      panels={["banner"]}
      eyebrow="Site"
      title="Banners"
      description="Imagem de capa, altura, enquadramento, escurecimento e faixa de anúncio."
      previewFocus="hero"
    />
  );
}
