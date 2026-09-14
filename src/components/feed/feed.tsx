"use client";

import { Flag, LayoutGrid, List, Lock, MoreHorizontal, Pin, Sparkles } from "lucide-react";
import { useState } from "react";
import type { FeedPost } from "@/server/services/content.service";
import { api } from "@/lib/api-client";
import { relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/overlay";
import { Avatar, Badge, Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { LockedMedia, MediaKindIcon, UnlockedMedia } from "./post-media";
import { ReportDialog } from "./report-dialog";

type Category = { id: string; name: string; slug: string };

type FeedProps = {
  initialPosts: FeedPost[];
  initialCursor: string | null;
  categories: Category[];
  layout: "grid" | "list";
  allowLayoutToggle?: boolean;
  creator: { displayName: string; avatarUrl: string | null };
  texts: { lockedLabel: string; unlockLabel: string };
  loggedIn: boolean;
  onlyUnlocked?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function Feed(props: FeedProps) {
  const [posts, setPosts] = useState(props.initialPosts);
  const [cursor, setCursor] = useState(props.initialCursor);
  const [category, setCategory] = useState<string | null>(null);
  const [layout, setLayout] = useState(props.layout);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<FeedPost | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const toast = useToast();

  async function load(nextCategory: string | null, nextCursor: string | null) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "12" });
      if (nextCategory) qs.set("categoria", nextCategory);
      if (nextCursor) qs.set("cursor", nextCursor);
      if (props.onlyUnlocked) qs.set("desbloqueados", "1");
      const data = await api<{ posts: FeedPost[]; nextCursor: string | null }>(`/api/content?${qs}`);
      setPosts((prev) => (nextCursor ? [...prev, ...data.posts] : data.posts));
      setCursor(data.nextCursor);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function selectCategory(slug: string | null) {
    setCategory(slug);
    void load(slug, null);
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <div className="no-scrollbar -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1">
          <button onClick={() => selectCategory(null)} className={cn("chip shrink-0", !category && "chip-active")}>
            Tudo
          </button>
          {props.categories.map((c) => (
            <button key={c.id} onClick={() => selectCategory(c.slug)} className={cn("chip shrink-0", category === c.slug && "chip-active")}>
              {c.name}
            </button>
          ))}
        </div>
        {props.allowLayoutToggle && (
          <div className="hidden shrink-0 rounded-full border border-line p-0.5 sm:flex">
            <button aria-label="Grade" onClick={() => setLayout("grid")} className={cn("rounded-full p-1.5", layout === "grid" ? "bg-surface-2 text-ink" : "text-muted")}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button aria-label="Lista" onClick={() => setLayout("list")} className={cn("rounded-full p-1.5", layout === "list" ? "bg-surface-2 text-ink" : "text-muted")}>
              <List className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {loading && posts.length === 0 ? (
        <FeedSkeleton layout={layout} />
      ) : posts.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Lock className="h-5 w-5" />} title={props.emptyTitle ?? "Nenhuma publicação por aqui"} description={props.emptyDescription} />
        </div>
      ) : layout === "grid" ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
          {posts.map((p) => (
            <button key={p.id} onClick={() => setViewer(p)} className="group relative aspect-[4/5] overflow-hidden rounded-field text-left animate-fade-up">
              {p.locked ? (
                <LockedMedia post={p} lockedLabel={props.texts.lockedLabel} unlockLabel={props.texts.unlockLabel} compact />
              ) : p.media.length ? (
                p.media[0]!.kind === "VIDEO" ? (
                  <div className="relative h-full w-full bg-surface-2">
                    {p.coverUrl && <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                ) : (
                  <img src={p.media[0]!.url ?? undefined} alt={p.title} className="protected-media h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" draggable={false} loading="lazy" />
                )
              ) : (
                <div className="flex h-full w-full items-end bg-surface-2 p-4">
                  <p className="line-clamp-5 text-sm text-ink/80">{p.body || p.teaser}</p>
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10">
                <p className="truncate text-[13px] font-semibold text-white">{p.title}</p>
              </div>
              <div className="pointer-events-none absolute left-2 top-2 flex gap-1">
                {p.pinned && (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                    <Pin className="h-3 w-3" />
                  </span>
                )}
                {(p.type === "VIDEO" || p.mediaCount > 1) && (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                    <MediaKindIcon post={p} />
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} creator={props.creator} texts={props.texts} onReport={() => setReportId(p.id)} />
          ))}
        </div>
      )}

      {cursor && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" loading={loading} onClick={() => load(category, cursor)}>
            Carregar mais
          </Button>
        </div>
      )}

      <Modal open={!!viewer} onClose={() => setViewer(null)} title={viewer?.title ?? ""} size="lg">
        {viewer && (
          <PostCard
            post={viewer}
            creator={props.creator}
            texts={props.texts}
            onReport={() => {
              setReportId(viewer.id);
              setViewer(null);
            }}
            bare
          />
        )}
      </Modal>
      <ReportDialog open={!!reportId} onClose={() => setReportId(null)} contentId={reportId ?? undefined} loggedIn={props.loggedIn} />
    </div>
  );
}

export function PostCard({
  post,
  creator,
  texts,
  onReport,
  bare,
}: {
  post: FeedPost;
  creator: { displayName: string; avatarUrl: string | null };
  texts: { lockedLabel: string; unlockLabel: string };
  onReport: () => void;
  bare?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const hasMedia = post.mediaCount > 0 || !!post.coverUrl;
  return (
    <article className={cn(!bare && "card overflow-hidden animate-fade-up")}>
      <header className={cn("flex items-center gap-3", !bare && "px-4 pt-4")}>
        <Avatar src={creator.avatarUrl} name={creator.displayName} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{creator.displayName}</p>
          <p className="text-xs text-muted">
            {relative(post.publishedAt)}
            {post.category && <> · {post.category.name}</>}
          </p>
        </div>
        {post.pinned && <Badge tone="primary"><Pin className="h-3 w-3" /> Fixado</Badge>}
        {post.featured && !post.pinned && <Badge tone="info"><Sparkles className="h-3 w-3" /> Destaque</Badge>}
        {post.requiredPlan && <Badge tone={post.locked ? "neutral" : "success"}>{post.requiredPlan.name}</Badge>}
        <div className="relative">
          <button onClick={() => setMenu((v) => !v)} className="btn btn-ghost btn-icon h-8 w-8" aria-label="Opções">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <div className="card absolute right-0 top-9 z-10 w-44 p-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
              <button
                onClick={() => {
                  setMenu(false);
                  onReport();
                }}
                className="flex w-full items-center gap-2 rounded-field px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
              >
                <Flag className="h-4 w-4" /> Denunciar
              </button>
            </div>
          )}
        </div>
      </header>

      <div className={cn(!bare && "px-4", "pt-3")}>
        <h3 className="font-semibold">{post.title}</h3>
        {post.locked ? (
          post.teaser && <p className="mt-1 text-sm leading-relaxed text-ink/75">{post.teaser}</p>
        ) : (
          (post.body || post.teaser) && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink/80">{post.body || post.teaser}</p>
        )}
        {post.tags.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-2 text-xs text-primary/80">
            {post.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </p>
        )}
      </div>

      {(hasMedia || post.locked) && (
        <div className={cn("mt-3", !bare && "px-4 pb-4")}>
          <div className={cn("overflow-hidden rounded-field", post.type === "VIDEO" ? "aspect-video" : "aspect-[4/5] sm:aspect-[4/3]")}>
            {post.locked ? <LockedMedia post={post} lockedLabel={texts.lockedLabel} unlockLabel={texts.unlockLabel} /> : <UnlockedMedia post={post} />}
          </div>
        </div>
      )}
      {!hasMedia && !post.locked && !bare && <div className="pb-4" />}
    </article>
  );
}

function FeedSkeleton({ layout }: { layout: "grid" | "list" }) {
  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/5]" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="card space-y-3 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="aspect-[4/3] w-full" />
        </div>
      ))}
    </div>
  );
}
