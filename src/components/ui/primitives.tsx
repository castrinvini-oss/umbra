import { Loader2 } from "lucide-react";
import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// ── Button ───────────────────────────────────────────────────────────────────

type Variant = "primary" | "glow" | "outline" | "ghost" | "soft" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  href?: string;
  external?: boolean;
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "btn",
    `btn-${variant}`,
    size === "sm" && "btn-sm",
    size === "lg" && "btn-lg",
    size === "icon" && "btn-icon",
    extra,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, href, external, className, children, disabled, ...rest },
  ref,
) {
  const cls = buttonClass(variant, size, className);
  if (href) {
    return external ? (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

// ── Campos ───────────────────────────────────────────────────────────────────

type FieldProps = { label?: string; hint?: string; error?: string; className?: string; children: React.ReactNode; htmlFor?: string };

export function Field({ label, hint, error, className, children, htmlFor }: FieldProps) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? <p className="error-text">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} className={cn("input", invalid && "input-error", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, rows = 4, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cn("input", invalid && "input-error", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn("input", invalid && "input-error", className)} {...rest}>
        {children}
      </select>
    );
  },
);

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4", disabled && "opacity-50")}>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition",
          checked ? "border-primary/60 bg-primary" : "border-line bg-surface-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-[18px] w-[18px] rounded-full shadow transition-all",
            checked ? "left-[22px] bg-primary-fg" : "left-0.5 bg-muted",
          )}
        />
      </button>
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  invalid,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  invalid?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
      <span className="relative mt-0.5 h-[18px] w-[18px] shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className={cn(
            "peer absolute inset-0 cursor-pointer appearance-none rounded-[5px] border bg-bg transition checked:border-primary checked:bg-primary",
            invalid ? "border-danger" : "border-line",
          )}
        />
        <svg viewBox="0 0 16 16" className="pointer-events-none absolute inset-0 hidden text-primary-fg peer-checked:block" aria-hidden>
          <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-ink/85">{children}</span>
    </label>
  );
}

// ── Exibição ─────────────────────────────────────────────────────────────────

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tone === "neutral" && "bg-surface-2 text-muted",
        tone === "primary" && "bg-primary/15 text-primary",
        tone === "success" && "bg-success/15 text-success",
        tone === "warning" && "bg-warning/15 text-warning",
        tone === "danger" && "bg-danger/15 text-danger",
        tone === "info" && "bg-secondary/15 text-secondary",
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Avatar({ src, name, size = 40, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 font-semibold text-muted", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" draggable={false} /> : letters}
    </span>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="font-display text-[2rem] leading-none tracking-tight sm:text-[2.4rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Marca da plataforma: eclipse (umbra). */
export function LogoMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="11" fill="rgb(var(--c-primary))" />
      <circle cx="20.5" cy="12.5" r="9.6" fill="rgb(var(--c-bg))" />
    </svg>
  );
}

export function VerifiedBadge({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Perfil verificado" role="img">
      <path
        fill="rgb(var(--c-primary))"
        d="M12 1.8 14.6 4l3.4-.3.9 3.3 3 1.7-1.2 3.3 1.2 3.3-3 1.7-.9 3.3-3.4-.3L12 22.2 9.4 20l-3.4.3-.9-3.3-3-1.7L3.3 12 2.1 8.7l3-1.7.9-3.3 3.4.3z"
      />
      <path d="m7.8 12.2 2.8 2.8 5.6-5.8" fill="none" stroke="rgb(var(--c-primary-fg))" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
