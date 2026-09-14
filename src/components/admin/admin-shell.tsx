"use client";

import {
  BarChart3,
  Bell,
  CreditCard,
  ExternalLink,
  Flag,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Settings,
  Target,
  UserCircle,
  Users,
  X,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { relative } from "@/lib/format";
import { can, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Avatar, LogoMark } from "@/components/ui/primitives";

const GROUPS: { label: string; items: { href: string; label: string; icon: typeof LayoutDashboard; perm: Permission; badge?: "reports" }[] }[] = [
  {
    label: "Visão geral",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view" },
      { href: "/admin/relatorios", label: "Relatórios", icon: BarChart3, perm: "reports.view" },
    ],
  },
  {
    label: "Vendas",
    items: [
      { href: "/admin/leads", label: "CRM", icon: Target, perm: "leads.manage" },
      { href: "/admin/assinantes", label: "Assinantes", icon: Users, perm: "subscribers.view" },
      { href: "/admin/pagamentos", label: "Pagamentos", icon: Wallet, perm: "payments.view" },
      { href: "/admin/planos", label: "Planos", icon: CreditCard, perm: "plans.manage" },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { href: "/admin/conteudos", label: "Conteúdos", icon: Layers, perm: "content.manage" },
      { href: "/admin/denuncias", label: "Denúncias", icon: Flag, perm: "moderation.manage", badge: "reports" },
    ],
  },
  {
    label: "Site",
    items: [
      { href: "/admin/perfil", label: "Perfil público", icon: UserCircle, perm: "site.manage" },
      { href: "/admin/banners", label: "Banners", icon: ImageIcon, perm: "site.manage" },
      { href: "/admin/personalizar", label: "Personalizar site", icon: Palette, perm: "site.manage" },
    ],
  },
  {
    label: "Sistema",
    items: [{ href: "/admin/configuracoes", label: "Configurações", icon: Settings, perm: "settings.manage" }],
  },
];

type Notification = { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };

export function AdminShell({
  children,
  user,
  siteName,
  openReports,
  demo,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; role: string };
  siteName: string;
  openReports: number;
  demo: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notes, setNotes] = useState<{ items: Notification[]; unread: number }>({ items: [], unread: 0 });

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ items: Notification[]; unread: number }>("/api/notifications")
        .then((d) => alive && setNotes(d))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  }

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => can(user.role, i.perm));
        if (!items.length) return null;
        return (
          <div key={g.label}>
            <p className="eyebrow mb-2 px-3 text-[10px]">{g.label}</p>
            <div className="space-y-0.5">
              {items.map(({ href, label, icon: Icon, badge }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-field px-3 py-2 text-[13.5px] font-medium transition",
                      active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink",
                    )}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
                    <Icon className={cn("h-[17px] w-[17px]", active && "text-primary")} />
                    <span className="flex-1">{label}</span>
                    {badge === "reports" && openReports > 0 && (
                      <span className="rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{openReports}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  const sidebarFooter = (
    <div className="border-t border-line/60 p-3">
      <div className="flex items-center gap-3 px-2 py-1.5">
        <Avatar name={user.name} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-[11px] text-muted">{ROLE_LABELS[user.role as Role]}</p>
        </div>
        <button onClick={logout} className="btn btn-ghost btn-icon h-8 w-8" aria-label="Sair">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line/60 bg-surface/40 lg:flex">
        <Link href="/admin/dashboard" className="flex h-16 items-center gap-2.5 border-b border-line/60 px-5">
          <LogoMark size={24} />
          <span className="font-display text-[1.45rem] leading-none">{siteName}</span>
          <span className="ml-auto rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted">Admin</span>
        </Link>
        {nav}
        {sidebarFooter}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface animate-fade-up">
            <div className="flex h-14 items-center justify-between border-b border-line/60 px-4">
              <span className="flex items-center gap-2">
                <LogoMark size={22} />
                <span className="font-display text-xl">{siteName}</span>
              </span>
              <button onClick={() => setMobileOpen(false)} className="btn btn-ghost btn-icon h-9 w-9" aria-label="Fechar menu">
                <X className="h-4 w-4" />
              </button>
            </div>
            {nav}
            {sidebarFooter}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line/60 bg-bg/80 px-4 backdrop-blur-xl sm:px-6 lg:h-16">
          <button onClick={() => setMobileOpen(true)} className="btn btn-ghost btn-icon h-9 w-9 lg:hidden" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          {demo && <span className="rounded-full bg-secondary/15 px-2.5 py-1 text-[11px] font-semibold text-secondary">Modo Demo</span>}
          <div className="ml-auto flex items-center gap-1.5">
            <Link href="/" target="_blank" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              <ExternalLink className="h-4 w-4" /> Ver site
            </Link>
            <div className="relative">
              <button onClick={() => setBellOpen((v) => !v)} className="btn btn-ghost btn-icon relative h-9 w-9" aria-label="Notificações">
                <Bell className="h-[18px] w-[18px]" />
                {notes.unread > 0 && (
                  <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-fg">
                    {notes.unread > 9 ? "9+" : notes.unread}
                  </span>
                )}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                  <div className="card absolute right-0 top-11 z-50 w-[min(92vw,360px)] overflow-hidden bg-surface shadow-2xl">
                    <div className="flex items-center justify-between border-b border-line px-4 py-3">
                      <p className="text-sm font-semibold">Notificações</p>
                      {notes.unread > 0 && (
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={async () => {
                            await api("/api/notifications", { method: "POST" });
                            setNotes((n) => ({ unread: 0, items: n.items.map((i) => ({ ...i, readAt: new Date().toISOString() })) }));
                          }}
                        >
                          Marcar todas como lidas
                        </button>
                      )}
                    </div>
                    <ul className="max-h-96 divide-y divide-line/60 overflow-y-auto">
                      {notes.items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Sem notificações</li>}
                      {notes.items.map((n) => (
                        <li key={n.id}>
                          <button
                            onClick={() => {
                              setBellOpen(false);
                              if (n.link) router.push(n.link);
                            }}
                            className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-surface-2/60"
                          >
                            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-line" : "bg-primary")} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">{n.title}</span>
                              {n.body && <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted">{relative(n.createdAt)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
