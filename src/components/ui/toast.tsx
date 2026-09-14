"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; title: string; description?: string };

const ToastCtx = createContext<{
  push: (t: Omit<Toast, "id">) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === "error" ? 6000 : 3800);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:right-6 md:left-auto md:items-end"
      >
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? TriangleAlert : Info;
          return (
            <div
              key={t.id}
              role="status"
              className="card pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 px-4 py-3 shadow-2xl shadow-black/40"
            >
              <Icon
                className={cn(
                  "mt-0.5 h-[18px] w-[18px] shrink-0",
                  t.tone === "success" && "text-success",
                  t.tone === "error" && "text-danger",
                  t.tone === "info" && "text-primary",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[13px] text-muted">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-muted transition hover:text-ink" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast fora do ToastProvider");
  return {
    success: (title: string, description?: string) => ctx.push({ tone: "success", title, description }),
    error: (title: string, description?: string) => ctx.push({ tone: "error", title, description }),
    info: (title: string, description?: string) => ctx.push({ tone: "info", title, description }),
  };
}
