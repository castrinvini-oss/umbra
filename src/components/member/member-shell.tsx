"use client";

import { CreditCard, Home, LayoutGrid, LogOut, Settings, Shield, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Avatar, LogoMark } from "@/components/ui/primitives";

const NAV = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/conteudos", label: "Conteúdos", icon: LayoutGrid },
  { href: "/meu-plano", label: "Meu plano", icon: CreditCard },
  { href: "/perfil", label: "Perfil", icon: User },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

async function logout() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.location.assign("/");
}

export function MemberShell({
  children,
  user,
  siteName,
  planName,
  staff,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; avatarUrl: string | null };
  siteName: string;
  planName: string | null;
  staff: boolean;
}) {
  const pathname = usePathname();
  return (
    <div className="page-glow min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line/60 bg-bg/60 backdrop-blur-xl lg:flex">
        <Link href="/" className="flex h-16 items-center gap-2.5 px-6">
          <LogoMark />
          <span className="font-display text-2xl">{siteName}</span>
        </Link>
        <nav className="mt-4 flex-1 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink",
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", active && "text-primary")} />
                {label}
              </Link>
            );
          })}
          {staff && (
            <Link href="/admin/dashboard" className="mt-4 flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10">
              <Shield className="h-[18px] w-[18px]" /> Painel administrativo
            </Link>
          )}
        </nav>
        <div className="border-t border-line/60 p-3">
          <div className="flex items-center gap-3 rounded-field px-3 py-2">
            <Avatar src={user.avatarUrl} name={user.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{planName ?? "Sem plano ativo"}</p>
            </div>
          </div>
          <button onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-sm text-muted transition hover:bg-danger/10 hover:text-danger">
            <LogOut className="h-[18px] w-[18px]" /> Sair
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/60 bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={22} />
          <span className="font-display text-xl">{siteName}</span>
        </Link>
        <div className="flex items-center gap-1">
          {staff && (
            <Link href="/admin/dashboard" className="btn btn-ghost btn-icon h-9 w-9" aria-label="Painel">
              <Shield className="h-4 w-4 text-primary" />
            </Link>
          )}
          <button onClick={logout} className="btn btn-ghost btn-icon h-9 w-9" aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="pb-24 lg:pb-10 lg:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line/60 bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium", active ? "text-primary" : "text-muted")}>
              <Icon className="h-5 w-5" />
              {label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
