"use client";

import { Flag, GripVertical, Pencil, Pin, Plus, ShieldAlert, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ImageField, MediaLibrary, MediaPicker, MediaThumb, type LibraryMedia } from "@/components/admin/media-picker";
import { ConfirmDialog, Modal, Segmented, Tabs } from "@/components/ui/overlay";
import { Badge, Button, Checkbox, EmptyState, Field, Input, PageHeader, Select, Switch, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { CONTENT_STATUS_LABELS, CONTENT_TYPE_LABELS, CONTENT_TYPES, type ContentStatus, type ContentType } from "@/lib/constants";
import { dateTime } from "@/lib/format";
import { contentStatusTone } from "@/lib/tones";
import type { listAdminContent } from "@/server/services/content.service";

type Row = Awaited<ReturnType<typeof listAdminContent>>[number];
type Category = { id: string; name: string; slug: string; sortOrder: number };
type Plan = { id: string; name: string; level: number };

export function ContentManager({ contents, categories, plans }: { contents: Row[]; categories: Category[]; plans: Plan[] }) {
  const [tab, setTab] = useState<"posts" | "media" | "categories">("posts");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const rows = useMemo(() => (status === "all" ? contents : contents.filter((c) => c.status === status)), [contents, status]);

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/content/${deleting.id}`, { method: "DELETE" });
      toast.success("Publicação excluída");
      setDeleting(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Conteúdo"
        title="Conteúdos"
        description="Publique fotos, vídeos e textos. Arquivos premium ficam privados e só são entregues a quem tem permissão."
        actions={
          <Button variant="glow" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Nova publicação
          </Button>
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "posts", label: `Publicações (${contents.length})` },
          { value: "media", label: "Biblioteca de mídia" },
          { value: "categories", label: "Categorias" },
        ]}
      />

      <div className="mt-5">
        {tab === "posts" && (
          <>
            <Tabs
              className="mb-4"
              value={status}
              onChange={setStatus}
              tabs={[
                { value: "all", label: "Todas", count: contents.length },
                ...(["PUBLISHED", "SCHEDULED", "DRAFT", "REMOVED"] as ContentStatus[]).map((s) => ({
                  value: s,
                  label: CONTENT_STATUS_LABELS[s],
                  count: contents.filter((c) => c.status === s).length,
                })),
              ]}
            />
            {rows.length === 0 ? (
              <div className="card">
                <EmptyState title="Nenhuma publicação" action={<Button onClick={() => setEditing("new")}>Criar publicação</Button>} />
              </div>
            ) : (
              <div className="grid gap-3">
                {rows.map((c) => (
                  <div key={c.id} className="card flex flex-col gap-4 p-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="grid h-16 w-16 shrink-0 grid-cols-1 overflow-hidden rounded-field bg-surface-2">
                        {c.media[0] ? (
                          <MediaThumb m={{ kind: c.media[0].kind, url: c.media[0].thumb, originalName: c.media[0].originalName }} className="h-16 w-16" />
                        ) : (
                          <span className="grid place-items-center text-[10px] uppercase text-muted">Texto</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-semibold">{c.title}</p>
                          {c.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                          {c.featured && <Sparkles className="h-3.5 w-3.5 text-secondary" />}
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {CONTENT_TYPE_LABELS[c.type as ContentType]} · {c.media.length} mídia(s) · {c.categoryName ?? "Sem categoria"} ·{" "}
                          {c.requiredPlanName ? `Plano ${c.requiredPlanName}+` : "Gratuito"}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone={contentStatusTone[c.status]} dot>
                            {CONTENT_STATUS_LABELS[c.status as ContentStatus]}
                          </Badge>
                          <span className="text-[11px] text-muted">{dateTime(c.publishedAt ?? c.createdAt)}</span>
                          {!c.consentConfirmed && (
                            <Badge tone="warning">
                              <ShieldAlert className="h-3 w-3" /> Sem declaração
                            </Badge>
                          )}
                          {c.reports > 0 && (
                            <Badge tone="danger">
                              <Flag className="h-3 w-3" /> {c.reports} denúncia(s)
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 self-end sm:self-center">
                      <Button size="sm" variant="soft" onClick={() => setEditing(c)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => setDeleting(c)} aria-label="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {tab === "media" && <MediaLibrary />}
        {tab === "categories" && <CategoryManager categories={categories} />}
      </div>

      {editing && (
        <ContentEditor
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          categories={categories}
          plans={plans}
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
        onConfirm={remove}
        loading={busy}
        danger
        title="Excluir publicação?"
        description={`"${deleting?.title}" será removida. Os arquivos continuam na biblioteca de mídia.`}
        confirmLabel="Excluir"
      />
    </div>
  );
}

type SelectedMedia = { id: string; kind: string; url: string | null; originalName: string };

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function ContentEditor({
  initial,
  categories,
  plans,
  onClose,
  onSaved,
}: {
  initial: Row | null;
  categories: Category[];
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<ContentType>((initial?.type as ContentType) ?? "IMAGE");
  const [body, setBody] = useState(initial?.body ?? "");
  const [teaser, setTeaser] = useState(initial?.teaser ?? "");
  const [media, setMedia] = useState<SelectedMedia[]>(initial?.media.map((m) => ({ id: m.id, kind: m.kind, url: m.thumb, originalName: m.originalName })) ?? []);
  const [coverId, setCoverId] = useState<string | null>(initial?.coverMediaId ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(initial?.coverUrl ?? null);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [planId, setPlanId] = useState(initial ? (initial.requiredPlanId ?? "") : (plans[0]?.id ?? ""));
  const initialMode = !initial ? "now" : initial.status === "DRAFT" ? "draft" : initial.status === "SCHEDULED" ? "schedule" : initial.status === "REMOVED" ? "removed" : "now";
  const [mode, setMode] = useState<"draft" | "now" | "schedule" | "removed">(initialMode);
  const [publishAt, setPublishAt] = useState(toLocalInput(initial?.publishedAt ?? null));
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [consent, setConsent] = useState(initial?.consentConfirmed ?? false);
  const [picker, setPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save() {
    setSaving(true);
    setErrors({});
    const status = mode === "draft" ? "DRAFT" : mode === "schedule" ? "SCHEDULED" : mode === "removed" ? "REMOVED" : "PUBLISHED";
    const body_ = {
      title,
      type,
      body,
      teaser,
      categoryId: categoryId || null,
      requiredPlanId: planId || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      status,
      publishedAt: mode === "schedule" && publishAt ? new Date(publishAt).toISOString() : mode === "now" ? (initial?.status === "PUBLISHED" ? initial.publishedAt : null) : null,
      pinned,
      featured,
      mediaIds: type === "TEXT" ? [] : media.map((m) => m.id),
      coverMediaId: coverId,
      consentConfirmed: consent,
    };
    try {
      await api(initial ? `/api/content/${initial.id}` : "/api/content", { method: initial ? "PUT" : "POST", body: body_ });
      toast.success(initial ? "Publicação atualizada" : mode === "schedule" ? "Publicação agendada" : mode === "draft" ? "Rascunho salvo" : "Publicado!");
      onSaved();
    } catch (e) {
      if (e instanceof ApiClientError) setErrors(e.fields ?? {});
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function move(index: number, dir: -1 | 1) {
    setMedia((list) => {
      const next = [...list];
      const target = index + dir;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Editar publicação" : "Nova publicação"}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="glow" onClick={save} loading={saving}>
            {mode === "draft" ? "Salvar rascunho" : mode === "schedule" ? "Agendar" : mode === "removed" ? "Salvar" : initial ? "Salvar alterações" : "Publicar"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Field label="Título" error={errors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} placeholder="Ex.: Ensaio de sábado" />
          </Field>

          <div>
            <p className="label">Tipo</p>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setType(t)} className={`chip py-1.5 ${type === t ? "chip-active" : ""}`}>
                  {CONTENT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {type !== "TEXT" && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="label mb-0">Mídias ({media.length})</p>
                <Button size="sm" variant="soft" onClick={() => setPicker(true)}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
              {errors.mediaIds && <p className="error-text mb-2">{errors.mediaIds}</p>}
              {media.length === 0 ? (
                <button type="button" onClick={() => setPicker(true)} className="w-full rounded-card border border-dashed border-line py-10 text-sm text-muted hover:border-primary/50">
                  Enviar ou escolher {type === "VIDEO" ? "vídeo" : "fotos"} da biblioteca
                </button>
              ) : (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {media.map((m, i) => (
                    <li key={m.id} className="group relative aspect-square overflow-hidden rounded-field">
                      <MediaThumb m={m} className="h-full w-full" />
                      <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/70 p-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                        <button type="button" onClick={() => move(i, -1)} className="rounded bg-black/50 px-1.5 text-xs text-white" aria-label="Mover para trás">
                          ←
                        </button>
                        <GripVertical className="h-4 w-4 text-white/60" />
                        <button type="button" onClick={() => move(i, 1)} className="rounded bg-black/50 px-1.5 text-xs text-white" aria-label="Mover para frente">
                          →
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMedia((l) => l.filter((x) => x.id !== m.id))}
                        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                        aria-label="Remover"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {i === 0 && <span className="absolute left-1 top-1 rounded bg-primary px-1 text-[9px] font-bold text-primary-fg">1ª</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Field label="Texto da publicação" hint="Visível apenas para quem tem acesso.">
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <Field label="Prévia pública" hint="Aparece para todos, inclusive quando o conteúdo está bloqueado." error={errors.teaser}>
            <Textarea rows={2} value={teaser} onChange={(e) => setTeaser(e.target.value)} maxLength={400} />
          </Field>
          {type !== "TEXT" && (
            <ImageField
              label="Capa pública (opcional)"
              hint="Imagem de prévia exibida no lugar do conteúdo bloqueado — ideal para vídeos. Sem capa, usamos uma versão desfocada."
              value={coverId}
              url={coverUrl}
              onChange={(id, url) => {
                setCoverId(id);
                setCoverUrl(url);
              }}
              aspect="aspect-[4/5]"
            />
          )}
        </div>

        <div className="space-y-5">
          <div className="card card-pad space-y-4">
            <p className="text-sm font-semibold">Publicação</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["now", "Publicar agora"],
                  ["schedule", "Agendar"],
                  ["draft", "Rascunho"],
                  ...(initial ? [["removed", "Removido"]] : []),
                ] as [typeof mode, string][]
              ).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setMode(v)} className={`chip justify-center py-2 ${mode === v ? "chip-active" : ""}`}>
                  {l}
                </button>
              ))}
            </div>
            {mode === "schedule" && (
              <Field label="Data de publicação">
                <Input type="datetime-local" value={publishAt} min={toLocalInput(new Date().toISOString())} onChange={(e) => setPublishAt(e.target.value)} />
              </Field>
            )}
            <Field label="Plano mínimo necessário">
              <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">Gratuito — visível para todos</option>
                {plans
                  .slice()
                  .sort((a, b) => a.level - b.level)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (nível {p.level}) ou superior
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Categoria">
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tags" hint="Separe por vírgula">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ensaio, bastidores" />
            </Field>
            <Switch checked={pinned} onChange={setPinned} label="Fixar no topo" />
            <Switch checked={featured} onChange={setFeatured} label="Destaque" />
          </div>

          <div className={`rounded-card border p-4 ${errors.consentConfirmed ? "border-danger/60 bg-danger/5" : "border-warning/30 bg-warning/5"}`}>
            <Checkbox checked={consent} onChange={setConsent} invalid={!!errors.consentConfirmed}>
              <span className="text-[13px]">
                Declaro que <b>todas as pessoas retratadas têm 18 anos ou mais</b>, consentiram com a produção e a publicação, e que possuo os direitos
                sobre este conteúdo.
              </span>
            </Checkbox>
            <p className="mt-2 pl-7 text-[11px] text-muted">Obrigatório para publicar. Registrado com data e autor.</p>
          </div>
        </div>
      </div>

      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        visibility="PRIVATE"
        kind={type === "VIDEO" ? "VIDEO" : type === "IMAGE" || type === "GALLERY" ? undefined : undefined}
        multiple={type !== "IMAGE"}
        selected={media.map((m) => m.id)}
        title="Mídias da publicação"
        onSelect={(items: LibraryMedia[]) => setMedia(items.map((m) => ({ id: m.id, kind: m.kind, url: m.url, originalName: m.originalName })))}
      />
    </Modal>
  );
}

function CategoryManager({ categories }: { categories: Category[] }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/admin/categories", { method: "POST", body: { name, sortOrder: categories.length } });
      setName("");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad max-w-xl">
      <form onSubmit={add} className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria" />
        <Button type="submit" loading={busy}>
          Adicionar
        </Button>
      </form>
      <ul className="mt-5 divide-y divide-line/60">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted">/{c.slug}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:text-danger"
              onClick={async () => {
                if (!confirm(`Remover a categoria "${c.name}"? As publicações ficarão sem categoria.`)) return;
                await api(`/api/admin/categories/${c.id}`, { method: "DELETE" }).catch((e) => toast.error(e.message));
                router.refresh();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
        {categories.length === 0 && <p className="py-6 text-center text-sm text-muted">Nenhuma categoria.</p>}
      </ul>
    </div>
  );
}
