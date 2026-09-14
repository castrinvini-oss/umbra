import { parseJson } from "@/lib/utils";
import { getContentStats, listCategories } from "./content.service";
import { resolvePublicUrls } from "./media.service";
import { listPlans } from "./plan.service";
import { getMainProfile, getPublicProfile } from "./profile.service";
import { getSiteConfig } from "./settings.service";

/** Tudo que o editor visual precisa para montar formulário + preview ao vivo. */
export async function getSiteEditorData() {
  const [site, profileRow, publicProfile, plans, categories, stats] = await Promise.all([
    getSiteConfig(),
    getMainProfile(),
    getPublicProfile(),
    listPlans({ activeOnly: true }),
    listCategories(),
    getContentStats(),
  ]);
  const urls = await resolvePublicUrls([site.identity.logoMediaId, site.identity.faviconMediaId, site.seo.ogImageMediaId]);
  return {
    site,
    profile: {
      displayName: profileRow.displayName,
      username: profileRow.username,
      bio: profileRow.bio,
      headline: profileRow.headline,
      location: profileRow.location,
      verified: profileRow.verified,
      avatarMediaId: profileRow.avatarMediaId,
      bannerMediaId: profileRow.bannerMediaId,
      showSubscriberCount: profileRow.showSubscriberCount,
      socialLinks: parseJson<{ label: string; url: string }[]>(profileRow.socialLinks, []),
    },
    urls: {
      avatar: publicProfile.avatarUrl,
      banner: publicProfile.bannerUrl,
      logo: site.identity.logoMediaId ? (urls.get(site.identity.logoMediaId) ?? null) : null,
      favicon: site.identity.faviconMediaId ? (urls.get(site.identity.faviconMediaId) ?? null) : null,
      og: site.seo.ogImageMediaId ? (urls.get(site.seo.ogImageMediaId) ?? null) : null,
    },
    subscriberCount: publicProfile.subscriberCount ?? 0,
    plans,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    stats,
  };
}

export type SiteEditorData = Awaited<ReturnType<typeof getSiteEditorData>>;
