"use client";

import { Check, Film, ImagePlus, Lock, Trash2, UploadCloud, X, Globe } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Segmented } from "@/components/ui/overlay";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, uploadFile } from "@/lib/api-client";
import { bytes, date } from "@/lib/format";
import { cn } from "@/lib/utils";

export type LibraryMedia = {
  id: string;
  kind: string;
  visibility: string;
  originalName: string;
  title: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  usage: number;
  url: string | null;
  blurUrl: string | null;
};

type Upload = { name: string; progress: number; error?: string };

export function useMediaLibrary(filter: { kind?: string; visibility?: string }) {
  const [items, setItems] = useState<LibraryMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filter.kind) qs.set("kind", filter.kind);
    if (filter.visibility) qs.set("visibility", filter.visibility);
    try {
      const r = await api<{ media: LibraryMedia[] }>(`/api/admin/media?${qs}`);
      setItems(r.media);
    } finally {
      setLoading(false);
    }
  }, [filter.kind, filter.visibility]);
  useEffect(() => {
    void load();
  }, [load]);
  return { items, loading, reload: load };
}

/** Área de envio com arrastar-e-soltar, progresso e validação no servidor. */
export function Dropzone({
  visibility,
  accept = "image/*,video/*",
  multiple = true,
  onUploaded,
  compact,
}: {
  visibility: "PUBLIC" | "PRIVATE";
  accept?: string;
  multiple?: boolean;
  onUploaded: (media: { id: string; kind: string; url: string | null; originalName: string }) => void;
  compact?: boolean;
}) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, multiple ? 20 : 1);
    for (const file of list) {
      setUploads((u) => [...u, { name: file.name, progress: 0 }]);
      try {
        const res = await uploadFile(file, {
          visibility,
          onProgress: (p) => setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, progress: p } : x))),
        });
        setUploads((u) => u.filter((x) => x.name !== file.name));
        onUploaded(res.media);
      } catch (e) {
        setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, error: (e as Error).message } : x)));
        toast.error(`Falha: ${file.name}`, (e as Error).message);
      }
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-card border border-dashed text-center transition",
          compact ? "px-4 py-5" : "px-6 py-10",
          over ? "border-primary bg-primary/5" : "border-line hover:border-ink/25 hover:bg-surface-2/40",
        )}
      >
        <UploadCloud className={cn("text-primary", compact ? "h-6 w-6" : "h-8 w-8")} />
        <p className="mt-2 text-sm font-semibold">Arraste arquivos ou toque para enviar</p>
        <p className="mt-1 text-xs text-muted">
          JPG, PNG, WEBP, GIF, AVIF, MP4, MOV, WEBM · {visibility === "PUBLIC" ? "arquivo público" : "arquivo privado (protegido)"}
        </p>
      </button>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => handle(e.target.files).then(() => (e.target.value = ""))} />
      {uploads.length > 0 && (
        <ul className="mt-3 space-y-2">
          {uploads.map((u) => (
            <li key={u.name} className="rounded-field border border-line px-3 py-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="truncate">{u.name}</span>
                <span className={u.error ? "text-danger" : "text-muted"}>{u.error ?? `${u.progress}%`}</span>
              </div>
              {!u.error && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${u.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MediaThumb({ m, className }: { m: Pick<LibraryMedia, "kind" | "url" | "originalName"> & { blurUrl?: string | null }; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      {m.kind === "IMAGE" && m.url ? (
        <img src={m.url} alt={m.originalName} className="h-full w-full object-cover" loading="lazy" />
      ) : m.kind === "VIDEO" && m.url ? (
        <video src={`${m.url}#t=0.5`} preload="metadata" muted className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted">
          <Film className="h-5 w-5" />
        </div>
      )}
      {m.kind === "VIDEO" && (
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] font-bold uppercase text-white">vídeo</span>
      )}
    </div>
  );
}

/** Modal de seleção: biblioteca + envio. */
export function MediaPicker({
  open,
  onClose,
  onSelect,
  visibility,
  kind,
  multiple,
  selected = [],
  title = "Selecionar mídia",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (items: LibraryMedia[]) => void;
  visibility: "PUBLIC" | "PRIVATE";
  kind?: "IMAGE" | "VIDEO";
  multiple?: boolean;
  selected?: string[];
  title?: string;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  const { items, loading, reload } = useMediaLibrary({ kind, visibility });
  useEffect(() => {
    if (open) setPicked(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(id: string) {
    setPicked((p) => (multiple ? (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]) : [id]));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={visibility === "PUBLIC" ? "Arquivos públicos (perfil, banner, capas)." : "Arquivos privados — entregues somente a quem tem permissão."}
      size="xl"
      footer={
        <>
          <span className="mr-auto self-center text-xs text-muted">{picked.length} selecionado(s)</span>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!picked.length}
            onClick={() => {
              onSelect(picked.map((id) => items.find((i) => i.id === id)).filter((x): x is LibraryMedia => !!x));
              onClose();
            }}
          >
            Usar selecionada(s)
          </Button>
        </>
      }
    >
      <Dropzone
        compact
        visibility={visibility}
        accept={kind === "IMAGE" ? "image/*" : kind === "VIDEO" ? "video/*" : "image/*,video/*"}
        multiple={multiple}
        onUploaded={async (m) => {
          await reload();
          toggle(m.id);
        }}
      />
      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        {loading && items.length === 0 && Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton aspect-square" />)}
        {items.map((m) => {
          const idx = picked.indexOf(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className={cn("relative aspect-square overflow-hidden rounded-field ring-2 transition", idx >= 0 ? "ring-primary" : "ring-transparent hover:ring-line")}
            >
              <MediaThumb m={m} className="h-full w-full" />
              {idx >= 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-fg">
                  {multiple ? idx + 1 : <Check className="h-3 w-3" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!loading && items.length === 0 && <EmptyState title="Biblioteca vazia" description="Envie o primeiro arquivo acima." />}
    </Modal>
  );
}

/** Campo de imagem única (foto, banner, logo, favicon, OG): enviar, alterar, remover. */
export function ImageField({
  label,
  hint,
  value,
  url,
  onChange,
  aspect = "aspect-video",
  round,
}: {
  label: string;
  hint?: string;
  value: string | null;
  url: string | null;
  onChange: (id: string | null, url: string | null) => void;
  aspect?: string;
  round?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-center gap-4">
        <div className={cn("relative shrink-0 overflow-hidden border border-line bg-surface-2", round ? "h-20 w-20 rounded-full" : cn("w-40 rounded-field", aspect))}>
          {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-muted"><ImagePlus className="h-5 w-5" /></div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="soft" onClick={() => setOpen(true)}>
            {value ? "Alterar" : "Enviar"}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => onChange(null, null)}>
              <X className="h-3.5 w-3.5" /> Remover
            </Button>
          )}
        </div>
      </div>
      {hint && <p className="hint">{hint}</p>}
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        visibility="PUBLIC"
        kind="IMAGE"
        title={label}
        selected={value ? [value] : []}
        onSelect={([m]) => m && onChange(m.id, m.url)}
      />
    </div>
  );
}

/** Biblioteca completa (miniatura, nome, tipo, tamanho, data, status, editar, excluir). */
export function MediaLibrary() {
  const [kind, setKind] = useState<"" | "IMAGE" | "VIDEO">("");
  const [visibility, setVisibility] = useState<"" | "PUBLIC" | "PRIVATE">("");
  const [uploadVis, setUploadVis] = useState<"PUBLIC" | "PRIVATE">("PRIVATE");
  const { items, loading, reload } = useMediaLibrary({ kind: kind || undefined, visibility: visibility || undefined });
  const toast = useToast();

  async function rename(m: LibraryMedia) {
    const title = window.prompt("Nome de exibição", m.title ?? m.originalName);
    if (title === null) return;
    await api(`/api/admin/media/${m.id}`, { method: "PATCH", body: { title: title || null } }).catch((e) => toast.error(e.message));
    void reload();
  }

  async function remove(m: LibraryMedia) {
    if (!window.confirm(`Excluir "${m.title ?? m.originalName}" permanentemente?`)) return;
    try {
      await api(`/api/admin/media/${m.id}`, { method: "DELETE" });
    } catch (e) {
      if (!window.confirm(`${(e as Error).message}`)) return;
      await api(`/api/admin/media/${m.id}?force=1`, { method: "DELETE" }).catch((err) => toast.error(err.message));
    }
    toast.success("Mídia excluída");
    void reload();
  }

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Enviar para a biblioteca</p>
          <Segmented
            value={uploadVis}
            onChange={setUploadVis}
            options={[
              { value: "PRIVATE", label: "Privado" },
              { value: "PUBLIC", label: "Público" },
            ]}
          />
        </div>
        <Dropzone visibility={uploadVis} onUploaded={() => reload()} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["", "Todos"],
          ["IMAGE", "Imagens"],
          ["VIDEO", "Vídeos"],
        ].map(([v, l]) => (
          <button key={v} onClick={() => setKind(v as typeof kind)} className={cn("chip", kind === v && "chip-active")}>
            {l}
          </button>
        ))}
        <span className="mx-1 w-px bg-line" />
        {[
          ["", "Qualquer visibilidade"],
          ["PRIVATE", "Privados"],
          ["PUBLIC", "Públicos"],
        ].map(([v, l]) => (
          <button key={v} onClick={() => setVisibility(v as typeof visibility)} className={cn("chip", visibility === v && "chip-active")}>
            {l}
          </button>
        ))}
      </div>

      <div className={cn("card overflow-x-auto transition-opacity", loading && items.length > 0 && "opacity-60")}>
        {items.length === 0 && !loading ? (
          <EmptyState title="Nenhum arquivo" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Miniatura</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th className="text-right">Tamanho</th>
                <th>Data</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <MediaThumb m={m} className="h-12 w-12 rounded-field" />
                  </td>
                  <td className="max-w-[260px]">
                    <p className="truncate font-medium">{m.title ?? m.originalName}</p>
                    <p className="text-xs text-muted">
                      {m.width && m.height ? `${m.width}×${m.height} · ` : ""}
                      {m.usage} uso(s)
                    </p>
                  </td>
                  <td className="text-muted">{m.mimeType}</td>
                  <td className="text-right tabular-nums text-muted">{bytes(m.sizeBytes)}</td>
                  <td className="whitespace-nowrap text-muted">{date(m.createdAt)}</td>
                  <td>
                    {m.visibility === "PRIVATE" ? (
                      <Badge tone="primary">
                        <Lock className="h-3 w-3" /> Privado
                      </Badge>
                    ) : (
                      <Badge tone="info">
                        <Globe className="h-3 w-3" /> Público
                      </Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Button size="sm" variant="ghost" onClick={() => rename(m)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => remove(m)} aria-label="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
