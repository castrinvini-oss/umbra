import type { Prisma } from "@prisma/client";
import { parseJson, slugify } from "@/lib/utils";
import type { ContentInput } from "@/lib/validators";
import type { SessionUser } from "../auth/session";
import { db } from "../db";
import { HttpError } from "../http/api";
import { evaluateAccess, getActiveSubscription, type AccessReason, type ActiveSubscription } from "./access.service";
import { blurMediaUrl, publicMediaUrl, signedMediaUrl } from "./media.service";
import { getMainProfile } from "./profile.service";

export type FeedMedia = {
  id: string;
  kind: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  url: string | null; // somente quando desbloqueado
  blurUrl: string | null; // derivado minúsculo e desfocado
};

export type FeedPost = {
  id: string;
  title: string;
  type: string;
  teaser: string;
  body: string | null; // null quando bloqueado
  tags: string[];
  publishedAt: string | null;
  pinned: boolean;
  featured: boolean;
  category: { id: string; name: string; slug: string } | null;
  requiredPlan: { id: string; name: string; level: number } | null;
  locked: boolean;
  lockReason: AccessReason | null;
  coverUrl: string | null;
  mediaCount: number;
  media: FeedMedia[];
};

const FEED_INCLUDE = {
  category: true,
  requiredPlan: { select: { id: true, name: true, level: true } },
  media: { include: { media: true }, orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ContentInclude;

type ContentRow = Prisma.ContentGetPayload<{ include: typeof FEED_INCLUDE }>;

/**
 * Serializa a publicação de acordo com a permissão do usuário. Conteúdo
 * bloqueado NUNCA inclui URL do arquivo original nem o texto completo.
 */
function toFeedPost(row: ContentRow, user: SessionUser | null, sub: ActiveSubscription | null, coverUrl: string | null): FeedPost {
  const decision = evaluateAccess(user, sub, row);
  const locked = !decision.allowed;
  const media = row.media.filter((cm) => cm.media.status === "READY");
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    teaser: row.teaser,
    body: locked ? null : row.body,
    tags: parseJson<string[]>(row.tags, []),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    pinned: row.pinned,
    featured: row.featured,
    category: row.category ? { id: row.category.id, name: row.category.name, slug: row.category.slug } : null,
    requiredPlan: row.requiredPlan,
    locked,
    lockReason: locked ? decision.reason : null,
    coverUrl,
    mediaCount: media.length,
    media: media.map(({ media: m }) => ({
      id: m.id,
      kind: m.kind,
      mimeType: locked ? null : m.mimeType,
      width: m.width,
      height: m.height,
      url: locked ? null : signedMediaUrl(m, user?.id ?? null),
      blurUrl: m.visibility === "PUBLIC" ? publicMediaUrl(m) : blurMediaUrl(m),
    })),
  };
}

export async function getFeed(opts: {
  user: SessionUser | null;
  categorySlug?: string | null;
  limit?: number;
  cursor?: string | null;
  onlyUnlocked?: boolean;
  featuredOnly?: boolean;
}) {
  const now = new Date();
  const where: Prisma.ContentWhereInput = {
    status: "PUBLISHED",
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
    ...(opts.featuredOnly ? { featured: true } : {}),
  };
  const limit = Math.min(opts.limit ?? 12, 50);
  const rows = await db.content.findMany({
    where,
    include: FEED_INCLUDE,
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const sub = opts.user ? await getActiveSubscription(opts.user.id) : null;
  const coverIds = rows.map((r) => r.coverMediaId).filter((x): x is string => !!x);
  const covers = coverIds.length ? await db.media.findMany({ where: { id: { in: coverIds }, visibility: "PUBLIC" } }) : [];
  const coverMap = new Map(covers.map((c) => [c.id, publicMediaUrl(c)]));

  let posts = rows.slice(0, limit).map((r) => toFeedPost(r, opts.user, sub, r.coverMediaId ? (coverMap.get(r.coverMediaId) ?? null) : null));
  if (opts.onlyUnlocked) posts = posts.filter((p) => !p.locked);
  return { posts, nextCursor: rows.length > limit ? rows[limit - 1]!.id : null };
}

export async function getContentStats() {
  const now = new Date();
  const base = { status: "PUBLISHED", OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] };
  const [posts, images, videos] = await Promise.all([
    db.content.count({ where: base }),
    db.media.count({ where: { kind: "IMAGE", status: "READY", contents: { some: { content: base } } } }),
    db.media.count({ where: { kind: "VIDEO", status: "READY", contents: { some: { content: base } } } }),
  ]);
  return { posts, images, videos };
}

// ── Administração ────────────────────────────────────────────────────────────

async function validateRefs(input: ContentInput) {
  if (input.mediaIds.length) {
    const count = await db.media.count({ where: { id: { in: input.mediaIds }, status: "READY" } });
    if (count !== new Set(input.mediaIds).size) throw new HttpError(422, "Alguma mídia selecionada não existe mais");
  }
  if (input.type !== "TEXT" && input.status === "PUBLISHED" && input.mediaIds.length === 0) {
    throw new HttpError(422, "Adicione ao menos uma mídia ou use o tipo Texto", { mediaIds: "Obrigatório" });
  }
  if (input.status === "PUBLISHED" && !input.consentConfirmed) {
    throw new HttpError(422, "Confirme a declaração de maioridade e consentimento para publicar", {
      consentConfirmed: "Obrigatório para publicar",
    });
  }
}

function contentData(input: ContentInput, actorId: string) {
  const publishedAt =
    input.status === "PUBLISHED" ? (input.publishedAt ? new Date(input.publishedAt) : new Date()) : input.publishedAt ? new Date(input.publishedAt) : null;
  return {
    title: input.title,
    body: input.body,
    teaser: input.teaser,
    type: input.type,
    categoryId: input.categoryId || null,
    requiredPlanId: input.requiredPlanId || null,
    tags: JSON.stringify(input.tags),
    status: input.status === "SCHEDULED" ? "PUBLISHED" : input.status,
    publishedAt,
    pinned: input.pinned,
    featured: input.featured,
    coverMediaId: input.coverMediaId || null,
    ...(input.consentConfirmed ? { consentConfirmedAt: new Date(), consentConfirmedBy: actorId } : {}),
  };
}

export async function createContent(input: ContentInput, actorId: string) {
  if (input.status === "SCHEDULED") {
    if (!input.publishedAt || new Date(input.publishedAt) <= new Date()) throw new HttpError(422, "Escolha uma data futura para agendar");
    input = { ...input, status: "PUBLISHED" };
  }
  await validateRefs(input);
  const profile = await getMainProfile();
  return db.content.create({
    data: {
      ...contentData(input, actorId),
      profileId: profile.id,
      media: { create: input.mediaIds.map((mediaId, i) => ({ mediaId, sortOrder: i })) },
    },
  });
}

export async function updateContent(id: string, input: ContentInput, actorId: string) {
  const existing = await db.content.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Publicação não encontrada");
  if (input.status === "SCHEDULED") {
    if (!input.publishedAt || new Date(input.publishedAt) <= new Date()) throw new HttpError(422, "Escolha uma data futura para agendar");
    input = { ...input, status: "PUBLISHED" };
  }
  await validateRefs(input);
  return db.$transaction(async (tx) => {
    await tx.contentMedia.deleteMany({ where: { contentId: id } });
    return tx.content.update({
      where: { id },
      data: {
        ...contentData(input, actorId),
        removedReason: input.status === "REMOVED" ? existing.removedReason : null,
        media: { create: input.mediaIds.map((mediaId, i) => ({ mediaId, sortOrder: i })) },
      },
    });
  });
}

export async function listAdminContent(opts: { status?: string; q?: string; categoryId?: string; viewerId: string }) {
  const now = new Date();
  const where: Prisma.ContentWhereInput = {
    ...(opts.q ? { title: { contains: opts.q } } : {}),
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
  };
  if (opts.status === "SCHEDULED") Object.assign(where, { status: "PUBLISHED", publishedAt: { gt: now } });
  else if (opts.status === "PUBLISHED") Object.assign(where, { status: "PUBLISHED", OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] });
  else if (opts.status) Object.assign(where, { status: opts.status });

  const rows = await db.content.findMany({
    where,
    include: {
      category: true,
      requiredPlan: { select: { id: true, name: true } },
      media: { include: { media: true }, orderBy: { sortOrder: "asc" } },
      _count: { select: { reports: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  const coverIds = rows.map((r) => r.coverMediaId).filter((x): x is string => !!x);
  const covers = coverIds.length ? await db.media.findMany({ where: { id: { in: coverIds } } }) : [];
  const coverMap = new Map(covers.map((c) => [c.id, publicMediaUrl(c)]));
  return rows.map((r) => ({
    coverUrl: r.coverMediaId ? (coverMap.get(r.coverMediaId) ?? null) : null,
    id: r.id,
    title: r.title,
    body: r.body,
    teaser: r.teaser,
    type: r.type,
    status: r.status === "PUBLISHED" && r.publishedAt && r.publishedAt > now ? "SCHEDULED" : r.status,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    pinned: r.pinned,
    featured: r.featured,
    tags: parseJson<string[]>(r.tags, []),
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    requiredPlanId: r.requiredPlanId,
    requiredPlanName: r.requiredPlan?.name ?? null,
    coverMediaId: r.coverMediaId,
    consentConfirmed: !!r.consentConfirmedAt,
    removedReason: r.removedReason,
    reports: r._count.reports,
    media: r.media.map(({ media: m }) => ({
      id: m.id,
      kind: m.kind,
      originalName: m.originalName,
      thumb: m.kind === "IMAGE" ? signedMediaUrl(m, opts.viewerId) : null,
    })),
  }));
}

export async function listCategories() {
  return db.contentCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function createCategory(name: string, sortOrder = 0) {
  let slug = slugify(name) || "categoria";
  if (await db.contentCategory.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  return db.contentCategory.create({ data: { name, slug, sortOrder } });
}
