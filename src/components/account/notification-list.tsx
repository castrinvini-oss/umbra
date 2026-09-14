"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, EmptyState } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";
import { relative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };

export function NotificationList({ items, scope }: { items: Item[]; scope: "me" | "staff" }) {
  const router = useRouter();
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Bell className="h-4 w-4 text-primary" /> Notificações
        </h2>
        {unread > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await api(`/api/notifications${scope === "me" ? "?scope=me" : ""}`, { method: "POST" });
              router.refresh();
            }}
          >
            Marcar como lidas
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState title="Nada por aqui" description="Avisos sobre pagamentos e assinatura aparecem aqui." />
      ) : (
        <ul className="divide-y divide-line/60">
          {items.map((n) => {
            const inner = (
              <div className="flex gap-3 px-5 py-3.5">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                </div>
                <span className="shrink-0 text-[11px] text-muted">{relative(n.createdAt)}</span>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block transition hover:bg-surface-2/50">{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
