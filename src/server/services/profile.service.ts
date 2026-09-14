import { cache } from "react";
import { parseJson } from "@/lib/utils";
import type { ProfileInput } from "@/lib/validators";
import { db } from "../db";
import { HttpError } from "../http/api";
import { resolvePublicUrls } from "./media.service";

/** Perfil principal do creator (plataforma de creator único). Cria um padrão se não existir. */
export const getMainProfile = cache(async () => {
  const existing = await db.profile.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return db.profile.create({ data: { displayName: "Seu Nome", username: "seuperfil", bio: "Edite sua bio no painel." } });
});

export type PublicProfile = Awaited<ReturnType<typeof getPublicProfile>>;

export const getPublicProfile = cache(async () => {
  const profile = await getMainProfile();
  const urls = await resolvePublicUrls([profile.avatarMediaId, profile.bannerMediaId]);
  const subscriberCount = profile.showSubscriberCount
    ? await db.subscription.count({ where: { status: { in: ["ACTIVE", "PAST_DUE"] }, currentPeriodEnd: { gt: new Date() } } })
    : null;
  return {
    id: profile.id,
    displayName: profile.displayName,
    username: profile.username,
    bio: profile.bio,
    headline: profile.headline,
    location: profile.location,
    verified: profile.verified,
    avatarMediaId: profile.avatarMediaId,
    bannerMediaId: profile.bannerMediaId,
    avatarUrl: profile.avatarMediaId ? (urls.get(profile.avatarMediaId) ?? null) : null,
    bannerUrl: profile.bannerMediaId ? (urls.get(profile.bannerMediaId) ?? null) : null,
    socialLinks: parseJson<{ label: string; url: string }[]>(profile.socialLinks, []),
    showSubscriberCount: profile.showSubscriberCount,
    subscriberCount,
  };
});

export async function updateProfile(input: ProfileInput) {
  const profile = await getMainProfile();
  const taken = await db.profile.findFirst({ where: { username: input.username, id: { not: profile.id } } });
  if (taken) throw new HttpError(409, "Username já em uso", { username: "Indisponível" });
  for (const id of [input.avatarMediaId, input.bannerMediaId]) {
    if (!id) continue;
    const m = await db.media.findUnique({ where: { id } });
    if (!m || m.kind !== "IMAGE" || m.visibility !== "PUBLIC") {
      throw new HttpError(422, "Foto de perfil e banner precisam ser imagens públicas");
    }
  }
  return db.profile.update({
    where: { id: profile.id },
    data: { ...input, socialLinks: JSON.stringify(input.socialLinks) },
  });
}
