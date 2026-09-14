"use client";

import { Download } from "lucide-react";
import { BarList, ChartCard } from "@/components/admin/charts";
import { StatTile } from "@/components/admin/stat-tile";
import { Button, PageHeader } from "@/components/ui/primitives";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/constants";
import { money, moneyCompact, num, pct } from "@/lib/format";
import type { getReports } from "@/server/services/analytics.service";

type Data = Awaited<ReturnType<typeof getReports>>;

export function ReportsView({ data }: { data: Data }) {
  return (
    <div>
      <PageHeader
        eyebrow="Visão geral"
        title="Relatórios"
        description="Indicadores de receita recorrente e retenção dos últimos 12 meses."
        actions={
          <>
            <Button href="/api/admin/export/pagamentos" external variant="outline" size="sm">
              <Download className="h-4 w-4" /> Pagamentos
            </Button>
            <Button href="/api/admin/export/assinantes" external variant="outline" size="sm">
              <Download className="h-4 w-4" /> Assinantes
            </Button>
            <Button href="/api/admin/export/leads" external variant="outline" size="sm">
              <Download className="h-4 w-4" /> Leads
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="MRR (receita recorrente mensal)" value={money(data.mrr)} hint={`${num(data.activeSubscribers)} assinaturas ativas`} />
        <StatTile label="Receita média por assinante" value={money(Math.round(data.arpu))} hint="por mês" />
        <StatTile label="Churn (30 dias)" value={pct(data.churn)} hint="cancelamentos ÷ base no início" />
        <StatTile label="LTV estimado" value={money(Math.round(data.ltv))} hint="receita média ÷ churn" />
        <StatTile label="Receita em 12 meses" value={moneyCompact(data.revenue12m)} />
        <StatTile label="Clientes pagantes" value={num(data.payingUsers)} hint="em 12 meses" />
        <StatTile label="Reembolsos" value={money(data.refunds.amount)} hint={`${num(data.refunds.count)} pagamentos`} />
        <StatTile label="Planos com vendas" value={num(data.byPlan.length)} />
      </div>

      <ChartCard
        kind="column"
        title="Receita mensal"
        subtitle="Pagamentos aprovados por mês"
        data={data.months.map((m) => ({ key: m.key, label: m.label, value: m.revenue }))}
        format={(v) => money(v)}
        axisFormat={(v) => moneyCompact(v)}
        height={260}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <p className="text-sm font-semibold">Receita por plano</p>
          <p className="mb-5 mt-0.5 text-xs text-muted">Últimos 12 meses</p>
          <BarList items={data.byPlan.map((p) => ({ label: p.name, value: p.revenue, detail: `${num(p.count)} vendas` }))} format={money} />
        </div>
        <div className="card card-pad">
          <p className="text-sm font-semibold">Receita por método de pagamento</p>
          <p className="mb-5 mt-0.5 text-xs text-muted">Últimos 12 meses</p>
          <BarList
            items={data.byMethod.map((m) => ({ label: PAYMENT_METHOD_LABELS[m.method as PaymentMethod] ?? m.method, value: m.revenue, detail: `${num(m.count)} pagamentos` }))}
            format={money}
          />
        </div>
      </div>
    </div>
  );
}
