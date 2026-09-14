import { profileSchema } from "@/lib/validators";
import { apiRoute } from "@/server/http/api";
import { logAdmin } from "@/server/services/audit.service";
import { getPublicProfile, updateProfile } from "@/server/services/profile.service";

export const GET = apiRoute({ auth: "public" }, async () => ({ profile: await getPublicProfile() }));

export const PUT = apiRoute({ auth: "site.manage", schema: profileSchema }, async ({ body, user, ip }) => {
  const profile = await updateProfile(body);
  await logAdmin({ actorId: user.id, action: "profile.update", entityType: "profile", entityId: profile.id, ip });
  return { ok: true };
});
