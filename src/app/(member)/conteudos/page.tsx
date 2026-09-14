import { Feed } from "@/components/feed/feed";
import { PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/guards";
import { getActiveSubscription } from "@/server/services/access.service";
import { getFeed, listCategories } from "@/server/services/content.service";
import { getPublicProfile } from "@/server/services/profile.service";
import { getSiteConfig } from "@/server/services/settings.service";

export const metadata = { title: "Conteúdos" };

export default async function MemberContentPage() {
  const user = await requireUser("/conteudos");
  const [site, profile, feed, categories, sub] = await Promise.all([
    getSiteConfig(),
    getPublicProfile(),
    getFeed({ user, limit: 12 }),
    listCategories(),
    getActiveSubscription(user.id),
  ]);
  return (
    <>
      <PageHeader
        eyebrow={sub ? `Plano ${sub.plan.name}` : "Prévia"}
        title="Conteúdos"
        description={sub ? "Tudo o que está liberado para o seu plano, organizado por categoria." : "Assine para desbloquear as publicações exclusivas."}
      />
      <Feed
        initialPosts={feed.posts}
        initialCursor={feed.nextCursor}
        categories={categories}
        layout="list"
        allowLayoutToggle
        creator={{ displayName: profile.displayName, avatarUrl: profile.avatarUrl }}
        texts={site.texts}
        loggedIn
      />
    </>
  );
}
