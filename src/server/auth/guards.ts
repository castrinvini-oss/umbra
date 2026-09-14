import { redirect } from "next/navigation";
import { can, type Permission } from "@/lib/permissions";
import { getCurrentUser } from "./session";

/** Para Server Components: exige login; redireciona para /login. */
export async function requireUser(next = "/dashboard") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Para Server Components do painel: exige permissão. */
export async function requirePermission(permission: Permission, next = "/admin/dashboard") {
  const user = await requireUser(next);
  if (!can(user.role, permission)) {
    if (can(user.role, "admin.access")) redirect("/admin/dashboard?negado=1");
    redirect("/dashboard");
  }
  return user;
}
