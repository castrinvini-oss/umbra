import { z } from "zod";
import { SITE_SECTIONS, type SiteConfig, type SiteSection } from "@/lib/site-config";
import { siteSectionSchemas } from "@/lib/validators";
import { apiRoute, badRequest } from "@/server/http/api";
import { logAdmin } from "@/server/services/audit.service";
import { getSiteConfig, saveSiteSection } from "@/server/services/settings.service";

export const GET = apiRoute({ auth: "site.manage" }, async () => ({ site: await getSiteConfig() }));

const bodySchema = z.object({ sections: z.record(z.string(), z.unknown()) });

/** Salva uma ou mais seções do CMS (identity, theme, texts, banner, layout, seo). */
export const PUT = apiRoute({ auth: "site.manage", schema: bodySchema }, async ({ body, user, ip }) => {
  const saved: Partial<SiteConfig> = {};
  for (const [key, value] of Object.entries(body.sections)) {
    if (!SITE_SECTIONS.includes(key as SiteSection)) throw badRequest(`Seção desconhecida: ${key}`);
    const section = key as SiteSection;
    const parsed = siteSectionSchemas[section].parse(value) as SiteConfig[typeof section];
    (saved as Record<string, unknown>)[section] = await saveSiteSection(section, parsed);
  }
  await logAdmin({ actorId: user.id, action: "site.update", ip, metadata: { sections: Object.keys(saved) } });
  return { ok: true, saved };
});
