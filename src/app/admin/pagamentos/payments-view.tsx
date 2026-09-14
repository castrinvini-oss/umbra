"use client";

import { CheckCircle2, Download, RefreshCw, Search, Settings, Undo2, Webhook, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StatTile } from "@/components/admin/stat-tile";
import { ConfirmDialog, Segmented, Tabs } from "@/components/ui/overlay";
import { Badge, Button, EmptyState, Input, PageHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { GATEWAY_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type GatewayName, type PaymentMethod, type PaymentStatus } from "@/lib/constants";
import { dateTime, money, num } from "@/lib/format";
import { paymentTone } from "@/lib/tones";
import type { listPayments } from "@/server/services/admin-queries.service";

type Payment = Awaited<ReturnType<typeof listPayments>>[number];
type Hook = { id: string; gateway: string; eventId: string; type: string; status: string; error: string | null; createdAt: string; processedAt: string | null };

export function PaymentsView({
  payments,
  webhooks,
  gateway,
  mode,
  demo,
  canManage,
}: {
  payments: Payment[];
  webhooks: Hook[];
  gateway: string;
  mode: string;
  demo: boolean;
  canManage: boolean;
}) {
  const [tab, setTab] = useState<"payments" | "webhooks">("payments");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [refund, setRefund] = useState<Payment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return payments.filter(
      (p) => (status === "all" || p.status === status) && (!term || p.userName.toLowerCase().includes(term) || p.userEmail.includes(term) || (p.gatewayPaymentId ?? "").includes(term)),
    );
  }, [payments, status, q]);

  const paid = payments.filter((p) => p.status === "PAID");
  const pending = payments.filter((p) => p.status === "PENDING");
  const refunded = payments.filter((p) => p.status === "REFUNDED");

  async function act(p: Payment, action: "refund" | "sync" | "simulatePaid" | "simulateFailed") {
    setBusy(`${p.id}:${action}`);
    try {
      await api(`/api/admin/payments/${p.id}`, { method: "POST", body: { action } });
      toast.success(
        action === "refund" ? "Reembolso processado" : action === "sync" ? "Status sincronizado com o gateway" : "Webhook simulado processado",
      );
      setRefund(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Vendas"
        title="Pagamentos"
        description={`Gateway ativo: ${GATEWAY_LABELS[gateway as GatewayName] ?? gateway} (${mode === "production" ? "produção" : "sandbox"}). Confirmações chegam por webhook.`}
        actions={
          <>
            <Button href="/api/admin/export/pagamentos" external variant="outline" size="sm">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button href="/admin/configuracoes?tab=pagamentos" variant="soft" size="sm">
              <Settings className="h-4 w-4" /> Configurar gateway
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Aprovados" value={money(paid.reduce((s, p) => s + p.amountCents, 0))} hint={`${num(paid.length)} pagamentos`} />
        <StatTile label="Pendentes" value={num(pending.length)} hint={money(pending.reduce((s, p) => s + p.amountCents, 0))} />
        <StatTile label="Recusados / expirados" value={num(payments.filter((p) => ["FAILED", "EXPIRED", "CANCELLED"].includes(p.status)).length)} />
        <StatTile label="Reembolsados" value={money(refunded.reduce((s, p) => s + p.amountCents, 0))} hint={`${num(refunded.length)} pagamentos`} />
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "payments", label: "Transações" },
          { value: "webhooks", label: `Webhooks (${webhooks.length})` },
        ]}
      />

      {tab === "payments" ? (
        <>
          <div className="my-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              value={status}
              onChange={setStatus}
              tabs={[{ value: "all", label: "Todos", count: payments.length }, ...(["PAID", "PENDING", "FAILED", "REFUNDED", "EXPIRED", "CANCELLED"] as PaymentStatus[]).map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s], count: payments.filter((p) => p.status === s).length }))]}
            />
            <div className="relative lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, e-mail ou ID do gateway" className="h-9 pl-9" />
            </div>
          </div>
          <div className="card overflow-x-auto">
            {rows.length === 0 ? (
              <EmptyState title="Nenhum pagamento" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Plano</th>
                    <th>Método</th>
                    <th className="text-right">Valor</th>
                    <th>Status</th>
                    <th>Gateway</th>
                    {canManage && <th className="text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap text-xs text-muted">
                        {dateTime(p.createdAt)}
                        {p.paidAt && <p className="text-success">pago {dateTime(p.paidAt)}</p>}
                      </td>
                      <td>
                        <p className="font-medium">{p.userName}</p>
                        <p className="text-xs text-muted">{p.userEmail}</p>
                      </td>
                      <td>
                        {p.planName}
                        {p.kind === "RENEWAL" && <p className="text-[11px] text-muted">renovação</p>}
                      </td>
                      <td>{PAYMENT_METHOD_LABELS[p.method as PaymentMethod]}</td>
                      <td className="text-right tabular-nums">{money(p.amountCents)}</td>
                      <td>
                        <Badge tone={paymentTone[p.status]}>{PAYMENT_STATUS_LABELS[p.status as PaymentStatus]}</Badge>
                        {p.failureReason && <p className="mt-1 max-w-[180px] truncate text-[11px] text-muted" title={p.failureReason}>{p.failureReason}</p>}
                      </td>
                      <td className="text-xs text-muted">
                        {p.gateway}
                        <p className="max-w-[140px] truncate font-mono text-[10px]">{p.gatewayPaymentId ?? "—"}</p>
                      </td>
                      {canManage && (
                        <td className="whitespace-nowrap text-right">
                          {p.status === "PENDING" && demo && p.gateway === "mock" && (
                            <>
                              <Button size="sm" variant="ghost" className="text-success" loading={busy === `${p.id}:simulatePaid`} onClick={() => act(p, "simulatePaid")} title="Simular aprovação">
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-danger" loading={busy === `${p.id}:simulateFailed`} onClick={() => act(p, "simulateFailed")} title="Simular recusa">
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {p.gateway !== "mock" && p.gatewayPaymentId && ["PENDING", "PAID"].includes(p.status) && (
                            <Button size="sm" variant="ghost" loading={busy === `${p.id}:sync`} onClick={() => act(p, "sync")} title="Consultar status no gateway">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          {p.status === "PAID" && (
                            <Button size="sm" variant="ghost" onClick={() => setRefund(p)} title="Reembolsar">
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <div className="card mt-4 overflow-x-auto">
          {webhooks.length === 0 ? (
            <EmptyState icon={<Webhook className="h-5 w-5" />} title="Nenhum webhook recebido" description="Eventos do gateway aparecem aqui com status de processamento." />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Recebido</th>
                  <th>Gateway</th>
                  <th>Evento</th>
                  <th>ID</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((w) => (
                  <tr key={w.id}>
                    <td className="whitespace-nowrap text-xs text-muted">{dateTime(w.createdAt)}</td>
                    <td>{w.gateway}</td>
                    <td className="font-mono text-xs">{w.type}</td>
                    <td className="max-w-[200px] truncate font-mono text-[11px] text-muted">{w.eventId}</td>
                    <td>
                      <Badge tone={w.status === "PROCESSED" ? "success" : w.status === "FAILED" ? "danger" : "neutral"}>{w.status}</Badge>
                      {w.error && <p className="mt-1 max-w-[240px] truncate text-[11px] text-danger">{w.error}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!refund}
        onClose={() => setRefund(null)}
        onConfirm={() => refund && act(refund, "refund")}
        loading={!!busy}
        danger
        title="Reembolsar pagamento?"
        description={refund ? `${money(refund.amountCents)} para ${refund.userName}. O acesso da assinatura será encerrado.` : ""}
        confirmLabel="Reembolsar"
      />
    </div>
  );
}
