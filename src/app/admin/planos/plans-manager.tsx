"use client";

import { Plus, Sparkles, Trash2, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { Badge, Button, EmptyState, Field, Input, PageHeader, Select, Switch, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { INTERVAL_OPTIONS, intervalSuffix } from "@/lib/constants";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PlanDTO } from "@/server/services/plan.service";

type Category = { id: string; name: string };

export function PlansManager({ plans, categories }: { plans: PlanDTO[]; categories: Category[] }) {
  const [editing, setEditing] = useState<PlanDTO | "new" | null>(null);
  const [deleting, setDeleting] = useState<PlanDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  return (
    <div>
      <PageHeader
        eyebrow="Vendas"
        title="Planos"
        description="Crie quantos planos quiser. O nível define a hierarquia: um plano libera conteúdos do mesmo nível ou inferiores."
        actions={
          <Button variant="glow" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Novo plano
          </Button>
        }
      />
      {plans.length === 0 ? (
        <div className="card">
          <EmptyState title="Nenhum plano criado" action={<Button onClick={() => setEditing("new")}>Criar plano</Button>} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className={cn("card card-pad flex flex-col", !p.active && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">
                    Ordem {p.sortOrder} · Nível {p.level}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{p.name}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {p.featured && (
                    <Badge tone="primary">
                      <Sparkles className="h-3 w-3" /> Destaque
                    </Badge>
                  )}
                  <Badge tone={p.active ? "success" : "neutral"} dot>
                    {p.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-3xl font-semibold">
                {money(p.priceCents)}
                <span className="text-sm font-normal text-muted">{intervalSuffix(p.intervalMonths)}</span>
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{p.description || "Sem descrição"}</p>
              <ul className="mt-3 flex-1 space-y-1 text-xs text-ink/75">
                {p.benefits.slice(0, 4).map((b) => (
                  <li key={b}>• {b}</li>
                ))}
                {p.benefits.length > 4 && <li className="text-muted">+{p.benefits.length - 4} benefícios</li>}
              </ul>
              <p className="mt-3 text-xs text-muted">
                Conteúdos liberados: {p.categoryIds.length ? p.categoryIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean).join(", ") : "todas as categorias"}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-4">
                <span className="flex items-center gap-1.5 text-sm">
                  <Users className="h-4 w-4 text-muted" /> {p.subscribers ?? 0} ativos
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="soft" onClick={() => setEditing(p)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => setDeleting(p)} aria-label="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PlanEditor
          key={editing === "new" ? "new" : editing.id}
          plan={editing === "new" ? null : editing}
          categories={categories}
          nextOrder={plans.length}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        loading={busy}
        danger
        title="Excluir plano?"
        description="Planos com assinaturas no histórico não podem ser excluídos — desative-os."
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          try {
            await api(`/api/plans/${deleting.id}`, { method: "DELETE" });
            toast.success("Plano excluído");
            setDeleting(null);
            router.refresh();
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function PlanEditor({ plan, categories, nextOrder, onClose, onSaved }: { plan: PlanDTO | null; categories: Category[]; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(plan?.name ?? "");
  const [slug, setSlug] = useState(plan?.slug ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [price, setPrice] = useState(plan ? (plan.priceCents / 100).toFixed(2).replace(".", ",") : "");
  const [intervalMonths, setIntervalMonths] = useState(plan?.intervalMonths ?? 1);
  const [level, setLevel] = useState(plan?.level ?? 1);
  const [benefits, setBenefits] = useState<string[]>(plan?.benefits ?? [""]);
  const [categoryIds, setCategoryIds] = useState<string[]>(plan?.categoryIds ?? []);
  const [active, setActive] = useState(plan?.active ?? true);
  const [featured, setFeatured] = useState(plan?.featured ?? false);
  const [sortOrder, setSortOrder] = useState(plan?.sortOrder ?? nextOrder);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save() {
    setSaving(true);
    setErrors({});
    const normalized = price.includes(",") ? price.replace(/\./g, "").replace(",", ".") : price;
    const priceCents = Math.round(Number(normalized) * 100);
    try {
      await api(plan ? `/api/plans/${plan.id}` : "/api/plans", {
        method: plan ? "PUT" : "POST",
        body: {
          name,
          slug: slug || undefined,
          description,
          priceCents: Number.isFinite(priceCents) ? priceCents : 0,
          intervalMonths,
          level,
          benefits: benefits.map((b) => b.trim()).filter(Boolean),
          categoryIds,
          active,
          featured,
          sortOrder,
        },
      });
      toast.success(plan ? "Plano atualizado" : "Plano criado");
      onSaved();
    } catch (e) {
      if (e instanceof ApiClientError) setErrors(e.fields ?? {});
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? `Editar ${plan.name}` : "Novo plano"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Salvar plano
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Premium" />
        </Field>
        <Field label="Slug (URL)" hint="Gerado automaticamente se vazio" error={errors.slug}>
          <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="premium" />
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Preço (R$)" error={errors.priceCents}>
          <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d,.]/g, ""))} placeholder="29,90" />
        </Field>
        <Field label="Período">
          <Select value={intervalMonths} onChange={(e) => setIntervalMonths(Number(e.target.value))}>
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.months} value={o.months}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nível de acesso" hint="Maior nível = mais conteúdos liberados">
          <Input type="number" min={1} max={99} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
        </Field>
        <Field label="Ordem de exibição">
          <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
        </Field>

        <div className="sm:col-span-2">
          <p className="label">Benefícios</p>
          <div className="space-y-2">
            {benefits.map((b, i) => (
              <div key={i} className="flex gap-2">
                <Input value={b} onChange={(e) => setBenefits((l) => l.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Ex.: Vídeos completos em HD" />
                <Button variant="ghost" size="icon" onClick={() => setBenefits((l) => l.filter((_, j) => j !== i))} aria-label="Remover benefício">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="soft" onClick={() => setBenefits((l) => [...l, ""])}>
              <Plus className="h-3.5 w-3.5" /> Adicionar benefício
            </Button>
          </div>
        </div>

        <div className="sm:col-span-2">
          <p className="label">Conteúdos liberados (categorias)</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={cn("chip", categoryIds.length === 0 && "chip-active")} onClick={() => setCategoryIds([])}>
              Todas
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn("chip", categoryIds.includes(c.id) && "chip-active")}
                onClick={() => setCategoryIds((l) => (l.includes(c.id) ? l.filter((x) => x !== c.id) : [...l, c.id]))}
              >
                {c.name}
              </button>
            ))}
          </div>
          <p className="hint">Combinado com o nível: o assinante acessa conteúdos do nível permitido nas categorias selecionadas.</p>
        </div>

        <div className="space-y-3 sm:col-span-2">
          <Switch checked={active} onChange={setActive} label="Plano ativo" description="Planos inativos não aparecem para novos assinantes; assinaturas existentes continuam." />
          <Switch checked={featured} onChange={setFeatured} label="Destacar plano" description="Exibe o selo “Mais escolhido”." />
        </div>
      </div>
    </Modal>
  );
}
