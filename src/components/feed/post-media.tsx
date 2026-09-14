"use client";

import { ChevronLeft, ChevronRight, Images, Lock, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { FeedPost } from "@/server/services/content.service";
import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/ui/primitives";

const block = (e: React.SyntheticEvent) => e.preventDefault();

function lockMessage(post: FeedPost, unlockLabel: string) {
  switch (post.lockReason) {
    case "plan_too_low":
      return post.requiredPlan ? `Disponível no plano ${post.requiredPlan.name}` : unlockLabel;
    case "category_not_included":
      return "Não incluído no seu plano";
    default:
      return unlockLabel;
  }
}

/** Área bloqueada: somente o derivado desfocado (nunca o arquivo original). */
export function LockedMedia({
  post,
  lockedLabel,
  unlockLabel,
  compact,
}: {
  post: FeedPost;
  lockedLabel: string;
  unlockLabel: string;
  compact?: boolean;
}) {
  const bg = post.coverUrl ?? post.media[0]?.blurUrl ?? null;
  const images = post.media.filter((m) => m.kind === "IMAGE").length;
  const videos = post.media.filter((m) => m.kind === "VIDEO").length;
  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-2">
      {bg ? (
        <img src={bg} alt="" aria-hidden className={cn("protected-media h-full w-full object-cover", !post.coverUrl && "scale-110 blur-2xl")} draggable={false} onContextMenu={block} />
      ) : (
        <div className="h-full w-full" style={{ background: "radial-gradient(90% 90% at 30% 20%, rgb(var(--c-primary) / 0.18), transparent 60%), rgb(var(--c-surface-2))" }} />
      )}
      <div className="absolute inset-0 bg-bg/55 backdrop-blur-[2px]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-primary/30 bg-bg/60 text-primary backdrop-blur">
          <Lock className="h-5 w-5" />
        </span>
        <p className={cn("mt-3 font-semibold", compact ? "text-sm" : "text-base")}>{lockedLabel}</p>
        {!compact && (images > 0 || videos > 0) && (
          <p className="mt-1 text-xs text-muted">
            {[images && `${images} foto${images > 1 ? "s" : ""}`, videos && `${videos} vídeo${videos > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
          </p>
        )}
        {!compact && (
          <Link href={post.lockReason === "login_required" || post.lockReason === "no_subscription" ? "/planos" : "/meu-plano"} className={buttonClass("glow", "sm", "mt-4")}>
            {lockMessage(post, unlockLabel)}
          </Link>
        )}
      </div>
    </div>
  );
}

/** Mídia liberada: carrossel para galerias, player para vídeos. */
export function UnlockedMedia({ post, rounded = true }: { post: FeedPost; rounded?: boolean }) {
  const [index, setIndex] = useState(0);
  const items = post.media;
  if (!items.length) return null;
  const current = items[Math.min(index, items.length - 1)]!;

  return (
    <div className={cn("group relative h-full w-full overflow-hidden bg-black", rounded && "rounded-field")} onContextMenu={block}>
      {current.kind === "VIDEO" ? (
        <video
          key={current.id}
          src={current.url ?? undefined}
          poster={post.coverUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          className="h-full w-full object-contain"
        />
      ) : (
        <img key={current.id} src={current.url ?? undefined} alt={post.title} className="protected-media h-full w-full object-contain" draggable={false} loading="lazy" />
      )}
      {items.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
            className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 max-sm:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Próxima"
            onClick={() => setIndex((i) => (i + 1) % items.length)}
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 max-sm:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {items.map((m, i) => (
              <span key={m.id} className={cn("h-1.5 rounded-full bg-white transition-all", i === index ? "w-4 opacity-100" : "w-1.5 opacity-50")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function MediaKindIcon({ post }: { post: FeedPost }) {
  if (post.type === "VIDEO") return <Play className="h-3.5 w-3.5 fill-current" />;
  if (post.mediaCount > 1) return <Images className="h-3.5 w-3.5" />;
  return null;
}
