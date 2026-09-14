"use client";

import { Table2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Gráficos SVG próprios (sem dependências).
 * Série única → cor de série validada para a superfície escura (#C8812F:
 * L 0.48–0.67, croma ≥ 0.1, contraste ≥ 3:1). O dourado da marca é claro demais
 * para marcas de dados, por isso os gráficos usam este passo mais profundo.
 * Marcas: colunas ≤ 24px com topo arredondado de 4px, linha de 2px, área a 10%,
 * grade em hairline sólida, tooltip por marca/crosshair e visão em tabela.
 */
export const VIZ_SERIES = "#C8812F";

export type Point = { key: string; label: string; value: number };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry!.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function ticks(max: number, count = 4) {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

type ChartCardProps = {
  title: string;
  subtitle?: string;
  headline?: string;
  data: Point[];
  format: (v: number) => string;
  axisFormat?: (v: number) => string;
  loading?: boolean;
  kind: "column" | "line";
  height?: number;
};

/** Cartão com título, gráfico (coluna ou linha), tooltip e alternância para tabela. */
export function ChartCard({ title, subtitle, headline, data, format, axisFormat, loading, kind, height = 200 }: ChartCardProps) {
  const [table, setTable] = useState(false);
  return (
    <div className={cn("card card-pad transition-opacity", loading && "opacity-60")}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          {headline && <p className="mt-2 text-2xl font-semibold">{headline}</p>}
        </div>
        <button
          onClick={() => setTable((v) => !v)}
          className={cn("chip shrink-0", table && "chip-active")}
          aria-pressed={table}
          aria-label={`Ver ${title} em tabela`}
        >
          <Table2 className="h-3.5 w-3.5" /> Tabela
        </button>
      </div>
      {table ? (
        <DataTable data={data} format={format} />
      ) : kind === "column" ? (
        <ColumnChart data={data} format={format} axisFormat={axisFormat ?? format} height={height} label={title} />
      ) : (
        <LineChart data={data} format={format} axisFormat={axisFormat ?? format} height={height} label={title} />
      )}
    </div>
  );
}

function DataTable({ data, format }: { data: Point[]; format: (v: number) => string }) {
  return (
    <div className="max-h-[240px] overflow-auto">
      <table className="table text-xs">
        <thead>
          <tr>
            <th>Período</th>
            <th className="text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <td>{d.label}</td>
              <td className="text-right tabular-nums">{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PAD = { top: 12, right: 12, bottom: 26, left: 52 };

function Tooltip({ x, y, value, label, width }: { x: number; y: number; value: string; label: string; width: number }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-field border border-line bg-surface px-3 py-2 shadow-xl"
      style={{ left, top: y - 8 }}
      role="status"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: VIZ_SERIES }} />
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">{label}</p>
    </div>
  );
}

function xLabelStep(count: number, width: number) {
  const fit = Math.max(2, Math.floor((width - PAD.left - PAD.right) / 56));
  return Math.max(1, Math.ceil(count / fit));
}

export function ColumnChart({
  data,
  format,
  axisFormat,
  height = 200,
  label,
}: {
  data: Point[];
  format: (v: number) => string;
  axisFormat: (v: number) => string;
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(24, band * 0.62));
  const step = xLabelStep(data.length, width);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible">
        {ticks(max).map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="rgb(var(--c-line))" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[10px] tabular-nums">
              {axisFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const h = Math.max(0, (d.value / max) * plotH);
          const x0 = cx - barW / 2;
          const top = PAD.top + plotH - h;
          const r = Math.min(4, h, barW / 2);
          const path =
            h > 0
              ? `M${x0},${PAD.top + plotH} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${PAD.top + plotH} Z`
              : "";
          return (
            <g key={d.key}>
              {path && <path d={path} fill={VIZ_SERIES} opacity={hover === null || hover === i ? 1 : 0.55} />}
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ${format(d.value)}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="outline-none"
              />
              {i % step === 0 && (
                <text x={cx} y={height - 8} textAnchor="middle" className="fill-muted text-[10px]">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="rgb(var(--c-muted) / 0.45)" strokeWidth={1} />
      </svg>
      {hover !== null && data[hover] && (
        <Tooltip
          x={PAD.left + band * hover + band / 2}
          y={y(data[hover]!.value)}
          value={format(data[hover]!.value)}
          label={data[hover]!.label}
          width={width}
        />
      )}
    </div>
  );
}

export function LineChart({
  data,
  format,
  axisFormat,
  height = 200,
  label,
}: {
  data: Point[];
  format: (v: number) => string;
  axisFormat: (v: number) => string;
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length <= 1 ? plotW / 2 : (plotW * i) / (data.length - 1));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const step = xLabelStep(data.length, width);

  const { line, area } = useMemo(() => {
    if (!data.length) return { line: "", area: "" };
    const pts = data.map((d, i) => `${x(i)},${y(d.value)}`);
    return {
      line: `M${pts.join(" L")}`,
      area: `M${x(0)},${PAD.top + plotH} L${pts.join(" L")} L${x(data.length - 1)},${PAD.top + plotH} Z`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, max]);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = data.length <= 1 ? 0 : Math.round(((px - PAD.left) / plotW) * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  }

  const last = data.length - 1;
  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label}
        className="block overflow-visible"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((h) => Math.min(last, (h ?? -1) + 1));
          if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? last + 1) - 1));
        }}
        onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={VIZ_SERIES} stopOpacity={0.14} />
            <stop offset="100%" stopColor={VIZ_SERIES} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {ticks(max).map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="rgb(var(--c-line))" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[10px] tabular-nums">
              {axisFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % step === 0 ? (
            <text key={d.key} x={x(i)} y={height - 8} textAnchor="middle" className="fill-muted text-[10px]">
              {d.label}
            </text>
          ) : null,
        )}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={VIZ_SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="rgb(var(--c-muted) / 0.6)" strokeWidth={1} />
        )}
        {data.length > 0 && (
          <circle
            cx={x(hover ?? last)}
            cy={y(data[hover ?? last]!.value)}
            r={4.5}
            fill={VIZ_SERIES}
            stroke="rgb(var(--c-surface))"
            strokeWidth={2}
          />
        )}
      </svg>
      {hover !== null && data[hover] && (
        <Tooltip x={x(hover)} y={y(data[hover]!.value)} value={format(data[hover]!.value)} label={data[hover]!.label} width={width} />
      )}
    </div>
  );
}

/** Barras horizontais (ranking) — série única, valor ao fim da barra. */
export function BarList({ items, format, empty = "Sem dados no período" }: { items: { label: string; value: number; detail?: string }[]; format: (v: number) => string; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const [hover, setHover] = useState<number | null>(null);
  if (!items.length) return <p className="py-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-3.5">
      {items.map((it, i) => (
        <li
          key={it.label}
          tabIndex={0}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
          className="outline-none"
          aria-label={`${it.label}: ${format(it.value)}${it.detail ? `, ${it.detail}` : ""}`}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink/90">{it.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {format(it.value)}
              {it.detail && <span className="ml-1.5 text-xs font-normal text-muted">{it.detail}</span>}
            </span>
          </div>
          <div className="h-2.5 w-full">
            <div
              className="h-full rounded-r-[4px] transition-opacity"
              style={{ width: `${Math.max(1.5, (it.value / max) * 100)}%`, background: VIZ_SERIES, opacity: hover === null || hover === i ? 1 : 0.55 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
