import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Stat tile: rótulo · valor (sans semibold, figuras proporcionais) · delta
 * opcional vs período anterior (ícone + texto, nunca só cor).
 */
export function StatTile({
  label,
  value,
  current,
  previous,
  upIsGood = true,
  hint,
  icon,
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  upIsGood?: boolean;
  hint?: string;
  icon?: React.ReactNode;
}) {
  let delta: React.ReactNode = null;
  if (current !== undefined && previous !== undefined) {
    const diff = current - previous;
    const pctChange = previous === 0 ? (current === 0 ? 0 : 1) : diff / previous;
    const good = diff === 0 ? null : diff > 0 === upIsGood;
    const Icon = diff === 0 ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
    delta = (
      <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", good === null ? "text-muted" : good ? "text-success" : "text-danger")}>
        <Icon className="h-3.5 w-3.5" />
        {previous === 0 && current > 0 ? "novo" : `${diff > 0 ? "+" : ""}${(pctChange * 100).toFixed(0)}%`}
        <span className="ml-1 font-normal text-muted">vs anterior</span>
      </span>
    );
  }
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <p className="mt-2 truncate text-[1.65rem] font-semibold leading-tight">{value}</p>
      <div className="mt-1.5 min-h-[18px]">{delta ?? (hint && <span className="text-xs text-muted">{hint}</span>)}</div>
    </div>
  );
}
