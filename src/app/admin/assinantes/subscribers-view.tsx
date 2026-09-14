"use client";

import { Ban, CalendarPlus, Download, Eye, MoreVertical, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog, Drawer, Tabs } from "@/components/ui/overlay";
import { Avatar, Badge, Button, EmptyState, Field, Input, PageHeader, Select, Switch } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import {
  intervalSuffix,
  LEAD_STAGE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  USER_STATUS_LABELS,
  type LeadStage,
  type PaymentMethod,
  type PaymentStatus,
  type SubscriptionStatus,
  type UserStatus,
} from "@/lib/constants";
import { date, dateTime, money } from "@/lib/format";
import { paymentTone, subscriptionTone } from "@/lib/tones";
import type { getSubscriberDetail, listSubscribers } from "@/server/services/admin-queries.service";

type Row = Awaited<ReturnType<typeof listSubscribers>>[number];
type Detail = NonNullable<Awaited<ReturnType<typeof getSubscriberDetail>>>;
type Action = { kind: "block" | "unblock" | "cancel" | "changePlan" | "grant"; row: Row };

const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Sem assinatura ativa" },
  { value: "blocked", label: "Bloqueados" },
];

export function SubscribersView({
  subscribers,
  plans,
  canManage,
  initialOpen,
}: {
  subscribers: Row[];
  plans: { id: string; name: string }[];
  canManage: boolean;
  initialOpen: string | null;
}) {
  const [filter, setFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("");
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [view, setView] = useState<{ id: string; tab: string } | null>(initialOpen ? { id: initialOpen, tab: "resumo" } : null);
  const [action, setAction] = useState<Action | null>(null);

  const isActive = (r: Row) => r.subscription && ["ACTIVE", "PAST_DUE"].includes(r.subscription.status);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return subscribers.filter((r) => {
      if (term && !r.name.toLowerCase().includes(term) && !r.email.includes(term)) return false;
      if (planFilter && r.subscription?.planId !== planFilter) return false;
      if (filter === "active") return isActive(r);
      if (filter === "inactive") return !isActive(r);
      if (filter === "blocked") return r.userStatus !== "ACTIVE";
      return true;
    });
  }, [subscribers, filter, planFilter, q]);

  return (
    <div>
      <PageHeader
        eyebrow="Vendas"
        title="Assinantes"
        description={`${subscribers.filter(isActive).length} ativos de ${subscribers.length} contas.`}
        actions={
          <Button href="/api/admin/export/assinantes" external variant="outline" size="sm">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
        <div className="flex gap-2">
          <Select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="h-9 w-auto">
            <option value="">Todos os planos</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <div className="relative flex-1 lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="h-9 pl-9" />
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title="Nenhum assinante encontrado" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Plano</th>
                <th>Status</th>
                <th className="text-right">Valor</th>
                <th>Próxima cobrança</th>
                <th>Cadastro</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.name} size={30} />
                      <span className="font-medium">{r.name}</span>
                      {r.userStatus !== "ACTIVE" && <Badge tone="danger">{USER_STATUS_LABELS[r.userStatus as UserStatus]}</Badge>}
                    </div>
                  </td>
                  <td className="text-muted">{r.email}</td>
                  <td>{r.subscription?.planName ?? "—"}</td>
                  <td>
                    {r.subscription ? (
                      <Badge tone={r.subscription.cancelAtPeriodEnd ? "warning" : subscriptionTone[r.subscription.status]} dot>
                        {r.subscription.cancelAtPeriodEnd ? "Cancela no fim" : SUBSCRIPTION_STATUS_LABELS[r.subscription.status as SubscriptionStatus]}
                      </Badge>
                    ) : (
                      <Badge>Sem assinatura</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums">
                    {r.subscription ? `${money(r.subscription.priceCents)}${intervalSuffix(r.subscription.intervalMonths)}` : "—"}
                  </td>
                  <td className="whitespace-nowrap">{r.subscription?.currentPeriodEnd ? date(r.subscription.currentPeriodEnd) : "—"}</td>
                  <td className="whitespace-nowrap text-muted">{date(r.createdAt)}</td>
                  <td className="text-right">
                    <div className="relative inline-block">
                      <button className="btn btn-ghost btn-icon h-8 w-8" onClick={() => setMenu(menu === r.id ? null : r.id)} aria-label="Ações">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menu === r.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                          <div className="card absolute right-0 top-9 z-20 w-56 bg-surface p-1 text-left shadow-2xl">
                            <MenuItem icon={Eye} label="Visualizar" onClick={() => setView({ id: r.id, tab: "resumo" })} />
                            <MenuItem icon={RefreshCw} label="Ver pagamentos" onClick={() => setView({ id: r.id, tab: "pagamentos" })} />
                            <MenuItem icon={CalendarPlus} label="Ver histórico" onClick={() => setView({ id: r.id, tab: "historico" })} />
                            <MenuItem icon={ShieldCheck} label="Ver atividade" onClick={() => setView({ id: r.id, tab: "atividade" })} />
                            {canManage && (
                              <>
                                <div className="my-1 h-px bg-line" />
                                {isActive(r) && <MenuItem icon={RefreshCw} label="Alterar plano" onClick={() => setAction({ kind: "changePlan", row: r })} />}
                                <MenuItem icon={CalendarPlus} label="Conceder acesso" onClick={() => setAction({ kind: "grant", row: r })} />
                                {isActive(r) && <MenuItem icon={XCircle} label="Cancelar assinatura" onClick={() => setAction({ kind: "cancel", row: r })} danger />}
                                {r.userStatus === "ACTIVE" ? (
                                  <MenuItem icon={Ban} label="Bloquear" onClick={() => setAction({ kind: "block", row: r })} danger />
                                ) : (
                                  <MenuItem icon={ShieldCheck} label="Desbloquear" onClick={() => setAction({ kind: "unblock", row: r })} />
                                )}
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SubscriberDrawer view={view} onClose={() => setView(null)} onTab={(tab) => view && setView({ ...view, tab })} />
      <ActionDialog action={action} plans={plans} onClose={() => setAction(null)} />
    </div>
  );

  function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Eye; label: string; onClick: () => void; danger?: boolean }) {
    return (
      <button
        onClick={() => {
          setMenu(null);
          onClick();
        }}
        className={`flex w-full items-center gap-2.5 rounded-field px-3 py-2 text-sm transition ${danger ? "text-danger hover:bg-danger/10" : "hover:bg-surface-2"}`}
      >
        <Icon className="h-4 w-4" /> {label}
      </button>
    );
  }
}

function ActionDialog({ action, plans, onClose }: { action: Action | null; plans: { id: string; name: string }[]; onClose: () => void }) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [months, setMonths] = useState(1);
  const [immediate, setImmediate] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();
  if (!action) return null;

  const titles = {
    block: "Bloquear conta",
    unblock: "Desbloquear conta",
    cancel: "Cancelar assinatura",
    changePlan: "Alterar plano",
    grant: "Conceder acesso manual",
  };

  async function run() {
    if (!action) return;
    setLoading(true);
    const body =
      action.kind === "block"
        ? { action: "block", reason }
        : action.kind === "cancel"
          ? { action: "cancel", immediate }
          : action.kind === "changePlan"
            ? { action: "changePlan", planId }
            : action.kind === "grant"
              ? { action: "grant", planId, months }
              : { action: "unblock" };
    try {
      await api(`/api/admin/subscribers/${action.row.id}`, { method: "POST", body });
      toast.success("Ação aplicada", titles[action.kind]);
      onClose();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={run}
      loading={loading}
      danger={action.kind === "block" || action.kind === "cancel"}
      title={titles[action.kind]}
      description={`${action.row.name} · ${action.row.email}`}
    >
      <div className="mt-4 space-y-4">
        {action.kind === "block" && (
          <Field label="Motivo (registrado no log)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
        {action.kind === "block" && <p className="text-xs text-muted">Todas as sessões serão encerradas e o acesso ao conteúdo, suspenso.</p>}
        {action.kind === "cancel" && (
          <Switch
            checked={immediate}
            onChange={setImmediate}
            label="Encerrar acesso imediatamente"
            description="Desligado: o assinante mantém acesso até o fim do período pago."
          />
        )}
        {(action.kind === "changePlan" || action.kind === "grant") && (
          <Field label="Plano">
            <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {action.kind === "changePlan" && <p className="text-xs text-muted">Altera o nível de acesso sem nova cobrança. A próxima cobrança no gateway não é alterada.</p>}
        {action.kind === "grant" && (
          <Field label="Duração (meses)">
            <Input type="number" min={1} max={24} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
          </Field>
        )}
      </div>
    </ConfirmDialog>
  );
}

function SubscriberDrawer({ view, onClose, onTab }: { view: { id: string; tab: string } | null; onClose: () => void; onTab: (t: string) => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const toast = useToast();
  const id = view?.id;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setDetail(null);
    api<{ subscriber: Detail }>(`/api/admin/subscribers/${id}`)
      .then((r) => alive && setDetail(r.subscriber))
      .catch((e) => alive && toast.error(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <Drawer open={!!view} onClose={onClose} title={detail?.name ?? "Assinante"} width="max-w-2xl">
      {!detail || !view ? (
        <div className="space-y-3">
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      ) : (
        <div>
          <div className="mb-5 flex items-center gap-3">
            <Avatar name={detail.name} size={48} />
            <div>
              <p className="font-semibold">{detail.name}</p>
              <p className="text-sm text-muted">{detail.email}</p>
            </div>
            <Badge tone={detail.status === "ACTIVE" ? "success" : "danger"} className="ml-auto">
              {USER_STATUS_LABELS[detail.status as UserStatus]}
            </Badge>
          </div>
          <Tabs
            value={view.tab}
            onChange={onTab}
            className="mb-5"
            tabs={[
              { value: "resumo", label: "Resumo" },
              { value: "pagamentos", label: "Pagamentos", count: detail.payments.length },
              { value: "historico", label: "Histórico" },
              { value: "atividade", label: "Atividade" },
            ]}
          />
          {view.tab === "resumo" && (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                <Info label="Telefone" value={detail.phone ?? "—"} />
                <Info label="Cadastro" value={dateTime(detail.createdAt)} />
                <Info label="Último login" value={dateTime(detail.lastLoginAt)} />
                <Info label="2FA" value={detail.twoFactorEnabled ? "Ativo" : "Não"} />
                <Info label="Etapa no CRM" value={detail.lead ? LEAD_STAGE_LABELS[detail.lead.stage as LeadStage] : "—"} />
                {detail.blockedReason && <Info label="Motivo do bloqueio" value={detail.blockedReason} />}
              </dl>
              <p className="label mt-4">Assinaturas</p>
              <div className="space-y-2">
                {detail.subscriptions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-field border border-line px-3 py-2.5">
                    <div>
                      <p className="font-medium">{s.plan.name}</p>
                      <p className="text-xs text-muted">
                        {date(s.currentPeriodStart)} → {date(s.currentPeriodEnd)} · {s.gateway}
                      </p>
                    </div>
                    <Badge tone={subscriptionTone[s.status]}>{SUBSCRIPTION_STATUS_LABELS[s.status as SubscriptionStatus]}</Badge>
                  </div>
                ))}
                {detail.subscriptions.length === 0 && <p className="text-muted">Nenhuma assinatura.</p>}
              </div>
            </div>
          )}
          {view.tab === "pagamentos" && (
            <div className="overflow-x-auto">
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Plano</th>
                    <th>Método</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap">{dateTime(p.createdAt)}</td>
                      <td>{p.plan.name}</td>
                      <td>{PAYMENT_METHOD_LABELS[p.method as PaymentMethod]}</td>
                      <td className="tabular-nums">{money(p.amountCents)}</td>
                      <td>
                        <Badge tone={paymentTone[p.status]}>{PAYMENT_STATUS_LABELS[p.status as PaymentStatus]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {view.tab === "historico" && (
            <Timeline items={(detail.lead?.events ?? []).map((e) => ({ id: e.id, text: e.description, at: e.createdAt }))} empty="Sem eventos no CRM." />
          )}
          {view.tab === "atividade" && (
            <Timeline items={detail.activities.map((a) => ({ id: a.id, text: `${a.type}${a.detail ? ` · ${a.detail}` : ""}${a.ip ? ` · IP ${a.ip}` : ""}`, at: a.createdAt }))} empty="Sem atividade registrada." />
          )}
        </div>
      )}
    </Drawer>
  );
}

function Timeline({ items, empty }: { items: { id: string; text: string; at: Date | string }[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ol className="relative ml-2 space-y-4 border-l border-line pl-5">
      {items.map((i) => (
        <li key={i.id} className="relative">
          <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-surface" />
          <p className="text-sm">{i.text}</p>
          <p className="text-[11px] text-muted">{dateTime(i.at)}</p>
        </li>
      ))}
    </ol>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
