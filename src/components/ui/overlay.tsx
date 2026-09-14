"use client";

import { Check, Copy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "./primitives";

// Pilha de camadas abertas: ESC fecha apenas a camada do topo (modais aninhados).
const layerStack: symbol[] = [];

function useLockScroll(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const id = Symbol("layer");
    layerStack.push(id);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && layerStack[layerStack.length - 1] === id) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      layerStack.splice(layerStack.indexOf(id), 1);
      if (layerStack.length === 0) document.body.style.overflow = prev === "hidden" ? "" : prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
}

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useLockScroll(open, onClose);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-up" onClick={onClose} />
        <div
          className={cn(
            "relative flex max-h-[92dvh] w-full animate-fade-up flex-col overflow-hidden rounded-t-[calc(var(--radius)*1px)] border border-line bg-surface shadow-2xl sm:rounded-card",
            size === "sm" && "sm:max-w-md",
            size === "md" && "sm:max-w-xl",
            size === "lg" && "sm:max-w-3xl",
            size === "xl" && "sm:max-w-5xl",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-icon -mr-2 -mt-1 h-9 w-9" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] sm:pb-3.5">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useLockScroll(open, onClose);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={title}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
        <aside className={cn("absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-surface shadow-2xl", width)} style={{ animation: "fade-up .25s ease both" }}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            <button onClick={onClose} className="btn btn-ghost btn-icon h-9 w-9" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
        </aside>
      </div>
    </Portal>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  danger,
  loading,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Voltar
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="text-sm text-muted">{description}</p>}
      {children}
    </Modal>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1", className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn("chip shrink-0 py-1.5", value === t.value ? "chip-active" : "hover:border-line hover:text-ink")}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-surface-2 px-1.5 text-[10px] text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-line bg-bg/50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition",
            value === o.value ? "bg-surface-2 text-ink shadow" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CopyButton({ value, label = "Copiar", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="soft"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiado" : label}
    </Button>
  );
}
