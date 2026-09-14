import { SiteEditor } from "@/components/admin/site-editor";
import { requirePermission } from "@/server/auth/guards";
import { getSiteEditorData } from "@/server/services/site-editor.service";

export const metadata = { title: "Personalizar site" };

export default async function CustomizePage() {
  await requirePermission("site.manage");
  const data = await getSiteEditorData();
  return (
    <SiteEditor
      data={data}
      panels={["identity", "profile", "colors", "layout", "content", "buttons"]}
      eyebrow="Site"
      title="Personalizar site"
      description="Identidade, cores, layout e botões com preview em tempo real. Nada é publicado até você salvar."
    />
  );
}
