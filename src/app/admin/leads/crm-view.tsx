"use client";

import { Download, Kanban, List, Mail, Phone, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StatTile } from "@/components/admin/stat-tile";
import { Drawer, Segmented, Tabs } from "@/components/ui/overlay";
import { Badge, Button, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { LEAD_STAGE_LABELS, LEAD_STAGES, type LeadStage } from "@/lib/constants";
import { dateTime, money, moneyCompact, num, pct, relative } from "@/lib/format";
import { leadStageTone } from "@/lib/tones";
import { cn } from "@/lib/utils";
import type { getLeadDetail, listLeads } from "@/server/services/admin-queries.service";
import type { getCrmStats } from "@/server/services/analytics.service";

type Lead = Awaited<ReturnType<typeof listLeads>>[number];
type Stats = Awaited<ReturnType<typeof getCrmStats>>;
type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>>;

const FILTERS: { value: string; label: string; stages: LeadStage[] | null }[] = [
  { value: "all", label: "Todos", stages: null },
  { value: "NEW", label: "Novos", stages: ["NEW"] },
  { value: "INTERESTED", label: "Interessados", stages: ["INTERESTED"] },
  { value: "CHECKOUT", label: "Checkout", stages: ["CHECKOUT"] },
  { value: "PAYMENT_PENDING", label: "Pagamento pendente", stages: ["PAYMENT_PENDING"] },
  { value: "CUSTOMER", label: "Clientes", stages: ["CUSTOMER", "RENEWAL"] },
  { value: "CANCELLED", label: "Cancelados", stages: ["CANCELLED"] },
];

export function CrmView({ leads, stats }: { leads: Lead[]; stats: Stats }) {
  const [view, setView] = useState<"pipeline" | "list">("pipeline");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.value === filter)!;
    const term = q.trim().toLowerCase();
    return leads.filter(
      (l) => (!f.stages || f.stages.includes(l.stage as LeadStage)) && (!term || l.name.toLowerCase().includes(term) || l.email.includes(term)),
    );
  }, [leads, filter, q]);

  async function moveStage(id: string, stage: LeadStage) {
    try {
      await api(`/api/admin/leads/${id}`, { method: "PATCH", body: { stage } });
      toast.success(`Movido para ${LEAD_STAGE_LABELS[stage]}`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const s = stats.stages;
  return (
    <div>
      <PageHeader
        eyebrow="Vendas"
        title="CRM"
        description="Todo visitante que cria conta vira lead. O funil avança sozinho com checkout, pagamento e renovação."
        actions={
          <Button href="/api/admin/export/leads" variant="outline" size="sm" external>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Total de leads" value={num(stats.total)} hint={`${num(stats.newThisWeek)} nos últimos 7 dias`} />
        <StatTile label="Leads novos" value={num(s.NEW)} />
        <StatTile label="Interessados" value={num(s.INTERESTED)} />
        <StatTile label="Checkout iniciado" value={num(s.CHECKOUT)} />
        <StatTile label="Pagamentos pendentes" value={num(s.PAYMENT_PENDING)} />
        <StatTile label="Clientes ativos" value={num(stats.activeCustomers)} hint={`${num(s.RENEWAL)} em renovação`} />
        <StatTile label="Clientes cancelados" value={num(s.CANCELLED)} />
        <StatTile label="Receita" value={moneyCompact(stats.revenue)} />
        <StatTile label="Conversão" value={pct(stats.conversion)} hint="Clientes ÷ total de leads" />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          tabs={FILTERS.map((f) => ({ value: f.value, label: f.label, count: f.stages ? leads.filter((l) => f.stages!.includes(l.stage as LeadStage)).length : leads.length }))}
          value={filter}
          onChange={setFilter}
        />
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome ou e-mail" className="h-9 pl-9" />
          </div>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "pipeline", label: "Pipeline" },
              { value: "list", label: "Lista" },
            ]}
          />
        </div>
      </div>

      {view === "pipeline" ? (
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {LEAD_STAGES.map((stage) => {
            const items = filtered.filter((l) => l.stage === stage);
            const value = items.reduce((sum, l) => sum + l.potentialValueCents, 0);
            return (
              <div
                key={stage}
                className="flex w-72 shrink-0 flex-col rounded-card border border-line/70 bg-surface/40"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId && leads.find((l) => l.id === dragId)?.stage !== stage) void moveStage(dragId, stage);
                  setDragId(null);
                }}
              >
                <div className="flex items-center justify-between border-b border-line/60 px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={leadStageTone[stage]} dot>
                      {LEAD_STAGE_LABELS[stage]}
                    </Badge>
                    <span className="text-xs text-muted">{items.length}</span>
                  </div>
                  <span className="text-[11px] text-muted">{moneyCompact(value)}</span>
                </div>
                <div className="flex max-h-[62vh] min-h-[120px] flex-col gap-2 overflow-y-auto p-2">
                  {items.map((l) => (
                    <button
                      key={l.id}
                      draggable
                      onDragStart={() => setDragId(l.id)}
                      onClick={() => setOpenId(l.id)}
                      className={cn("card w-full cursor-grab p-3 text-left transition hover:border-primary/40 active:cursor-grabbing", dragId === l.id && "opacity-50")}
                    >
                      <p className="truncate text-sm font-semibold">{l.name}</p>
                      <p className="truncate text-xs text-muted">{l.email}</p>
                      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-muted">
                        <span className="truncate">{l.planName ?? l.source}</span>
                        <span className="shrink-0">{relative(l.lastActivityAt)}</span>
                      </div>
                    </button>
                  ))}
                  {items.length === 0 && <p className="py-6 text-center text-xs text-muted/70">Arraste leads para cá</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          {filtered.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Telefone</th>
                  <th>Origem</th>
                  <th>Plano</th>
                  <th>Etapa</th>
                  <th className="text-right">Valor potencial</th>
                  <th>Última atividade</th>
                  <th>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="cursor-pointer" onClick={() => setOpenId(l.id)}>
                    <td>
                      <p className="font-medium">{l.name}</p>
                      <p className="text-xs text-muted">{l.email}</p>
                    </td>
                    <td className="text-muted">{l.phone ?? "—"}</td>
                    <td className="text-muted">{l.source}</td>
                    <td>{l.planName ?? "—"}</td>
                    <td>
                      <Badge tone={leadStageTone[l.stage]}>{LEAD_STAGE_LABELS[l.stage as LeadStage]}</Badge>
                    </td>
                    <td className="text-right tabular-nums">{money(l.potentialValueCents)}</td>
                    <td className="max-w-[220px]">
                      <p className="truncate text-xs">{l.lastActivity}</p>
                      <p className="text-[11px] text-muted">{relative(l.lastActivityAt)}</p>
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted">{dateTime(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="Nenhum lead encontrado" />
          )}
        </div>
      )}

      <LeadDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => router.refresh()} />
    </div>
  );
}

function LeadDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLead(null);
    api<{ lead: LeadDetail }>(`/api/admin/leads/${id}`)
      .then((r) => {
        if (!alive) return;
        setLead(r.lead);
        setNotes(r.lead.notes);
      })
      .catch((e) => alive && toast.error(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patch(body: Record<string, unknown>, message: string) {
    if (!lead) return;
    setSaving(true);
    try {
      const r = await api<{ lead: LeadDetail }>(`/api/admin/leads/${lead.id}`, { method: "PATCH", body });
      setLead(r.lead);
      toast.success(message);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={!!id} onClose={onClose} title={lead?.name ?? "Lead"}>
      {!lead ? (
        <div className="space-y-3">
          <div className="skeleton h-6 w-40" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="E-mail" value={<a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Mail className="h-3.5 w-3.5" />{lead.email}</a>} />
            <Info label="Telefone" value={lead.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{lead.phone}</span> : "—"} />
            <Info label="Origem" value={lead.source} />
            <Info label="Plano escolhido" value={lead.plan?.name ?? "—"} />
            <Info label="Valor potencial" value={money(lead.potentialValueCents)} />
            <Info label="Cadastro" value={dateTime(lead.createdAt)} />
            <Info label="Última atividade" value={dateTime(lead.lastActivityAt)} />
            <Info label="Última interação" value={dateTime(lead.lastInteractionAt)} />
          </div>

          <Field label="Etapa do funil">
            <Select value={lead.stage} disabled={saving} onChange={(e) => patch({ stage: e.target.value }, "Etapa atualizada")}>
              {LEAD_STAGES.map((st) => (
                <option key={st} value={st}>
                  {LEAD_STAGE_LABELS[st]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Anotações">
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button size="sm" variant="soft" className="mt-2" loading={saving} onClick={() => patch({ notes }, "Anotações salvas")}>
              Salvar anotações
            </Button>
          </Field>

          <div>
            <p className="label">Registrar interação</p>
            <div className="flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: respondeu no suporte, enviou cupom…" />
              <Button
                variant="soft"
                disabled={!note.trim()}
                onClick={async () => {
                  await patch({ note }, "Interação registrada");
                  setNote("");
                }}
              >
                Adicionar
              </Button>
            </div>
          </div>

          <div>
            <p className="label flex items-center gap-2">
              <List className="h-4 w-4" /> Histórico
            </p>
            <ol className="relative ml-2 space-y-4 border-l border-line pl-5">
              {lead.events.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className={cn("absolute -left-[25px] top-1.5 h-2 w-2 rounded-full ring-4 ring-surface", ev.type === "NOTE" ? "bg-secondary" : "bg-primary")} />
                  <p className="text-sm">{ev.description}</p>
                  <p className="text-[11px] text-muted">{dateTime(ev.createdAt)}</p>
                </li>
              ))}
            </ol>
          </div>
          {lead.user && (
            <Button href={`/admin/assinantes?u=${lead.user.id}`} variant="outline" size="sm">
              <Kanban className="h-4 w-4" /> Ver como assinante
            </Button>
          )}
        </div>
      )}
    </Drawer>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-0.5 truncate">{value}</div>
    </div>
  );
}
