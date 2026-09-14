"use client";

import { Check, Clock, CreditCard, Percent, ShoppingCart, Target, TrendingUp, UserMinus, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { BarList, ChartCard, type Point } from "@/components/admin/charts";
import { StatTile } from "@/components/admin/stat-tile";
import { Button, Input, PageHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { money, moneyCompact, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { getDashboardAnalytics } from "@/server/services/analytics.service";

type Analytics = Awaited<ReturnType<typeof getDashboardAnalytics>>;

const RANGES = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "custom", label: "Personalizado" },
] as const;

function bucketLabel(key: string, granularity: string) {
  if (granularity === "hour") return key;
  const [, m, d] = key.split("-");
  return granularity === "week" ? `sem ${d}/${m}` : `${d}/${m}`;
}

export function DashboardView({ initial, userName, denied }: { initial: Analytics; userName: string; denied: boolean }) {
  const [data, setData] = useState(initial);
  const [range, setRange] = useState<string>(initial.range);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function load(nextRange: string, f?: string, t?: string) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ range: nextRange });
      if (nextRange === "custom" && f && t) {
        qs.set("from", f);
        qs.set("to", t);
      }
      setData(await api<Analytics>(`/api/admin/analytics?${qs}`));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const series = (field: "revenue" | "subscribers" | "cancellations" | "conversion"): Point[] =>
    data.series.map((s) => ({ key: s.key, label: bucketLabel(s.key, data.granularity), value: s[field] }));
  const k = data.kpis;
  const sales = data.planMix.reduce((s, p) => s + p.count, 0);

  return (
    <div>
      <PageHeader eyebrow={`Olá, ${userName}`} title="Dashboard" description="Receita, assinantes e funil de conversão no período selecionado." />
      {denied && <p className="mb-4 rounded-field bg-warning/10 px-4 py-2.5 text-sm text-warning">Você não tem permissão para acessar aquela área.</p>}

      {/* Filtros: uma linha, acima de tudo que escopam */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => {
              setRange(r.value);
              if (r.value !== "custom") void load(r.value);
            }}
            className={cn("chip py-1.5", range === r.value && "chip-active")}
            aria-pressed={range === r.value}
          >
            {range === r.value && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            {r.label}
          </button>
        ))}
        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-auto" aria-label="De" />
            <span className="text-xs text-muted">até</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-auto" aria-label="Até" />
            <Button size="sm" variant="soft" disabled={!from || !to} onClick={() => load("custom", from, to)}>
              Aplicar
            </Button>
          </div>
        )}
      </div>

      <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Receita no período" value={money(k.revenue.value)} current={k.revenue.value} previous={k.revenue.previous} icon={<TrendingUp className="h-4 w-4" />} />
          <StatTile label="Assinantes ativos" value={num(k.activeSubscribers.value)} hint={`Receita total: ${moneyCompact(k.revenueAllTime)}`} icon={<Users className="h-4 w-4" />} />
          <StatTile label="Novos assinantes" value={num(k.newSubscribers.value)} current={k.newSubscribers.value} previous={k.newSubscribers.previous} icon={<UserPlus className="h-4 w-4" />} />
          <StatTile label="Novos leads" value={num(k.newLeads.value)} current={k.newLeads.value} previous={k.newLeads.previous} icon={<Target className="h-4 w-4" />} />
          <StatTile label="Conversão" value={pct(k.conversion.value)} current={k.conversion.value} previous={k.conversion.previous} icon={<Percent className="h-4 w-4" />} />
          <StatTile label="Checkouts" value={num(k.checkouts.value)} current={k.checkouts.value} previous={k.checkouts.previous} icon={<ShoppingCart className="h-4 w-4" />} />
          <StatTile label="Pagamentos pendentes" value={num(k.pendingPayments.value)} hint="Aguardando confirmação" icon={<Clock className="h-4 w-4" />} />
          <StatTile label="Cancelamentos" value={num(k.cancellations.value)} current={k.cancellations.value} previous={k.cancellations.previous} upIsGood={false} icon={<UserMinus className="h-4 w-4" />} />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ChartCard
              kind="column"
              title="Receita por período"
              subtitle={data.granularity === "hour" ? "Por hora" : data.granularity === "week" ? "Por semana" : "Por dia"}
              headline={money(k.revenue.value)}
              data={series("revenue")}
              format={(v) => money(v)}
              axisFormat={(v) => moneyCompact(v)}
              height={240}
              loading={loading}
            />
          </div>
          <div className="card card-pad">
            <p className="text-sm font-semibold">Plano mais vendido</p>
            <p className="mb-5 mt-0.5 text-xs text-muted">Pagamentos aprovados no período</p>
            <BarList items={data.planMix.map((p) => ({ label: p.name, value: p.count, detail: money(p.revenue) }))} format={(v) => `${num(v)} vendas`} />
            <div className="mt-6 flex items-center gap-2 border-t border-line/60 pt-4 text-xs text-muted">
              <CreditCard className="h-3.5 w-3.5" /> Ticket médio:{" "}
              <b className="text-ink">{sales ? money(Math.round(k.revenue.value / sales)) : "—"}</b>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard kind="column" title="Novos assinantes" data={series("subscribers")} format={(v) => num(Math.round(v))} loading={loading} />
          <ChartCard kind="column" title="Cancelamentos" data={series("cancellations")} format={(v) => num(Math.round(v))} loading={loading} />
          <ChartCard kind="line" title="Conversão" subtitle="Novos assinantes ÷ novos leads" data={series("conversion")} format={(v) => pct(v)} axisFormat={(v) => pct(v, 0)} loading={loading} />
        </div>
      </div>
    </div>
  );
}
