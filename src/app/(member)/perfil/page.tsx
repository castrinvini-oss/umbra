import { PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { resolvePublicUrls } from "@/server/services/media.service";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Perfil" };

export default async function MemberProfilePage() {
  const session = await requireUser("/perfil");
  const user = await db.user.findUniqueOrThrow({ where: { id: session.id }, select: { name: true, email: true, phone: true, avatarMediaId: true, createdAt: true } });
  const urls = await resolvePublicUrls([user.avatarMediaId]);
  return (
    <>
      <PageHeader eyebrow="Conta" title="Perfil" description="Suas informações pessoais. Seu perfil não é exibido publicamente." />
      <ProfileForm
        initial={{ name: user.name, email: user.email, phone: user.phone ?? "", avatarUrl: user.avatarMediaId ? (urls.get(user.avatarMediaId) ?? null) : null }}
      />
    </>
  );
}
