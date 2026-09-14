import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; redefinida?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(can(user.role, "admin.access") ? "/admin/dashboard" : "/dashboard");
  return <LoginForm next={sp.next} resetDone={sp.redefinida === "1"} />;
}
