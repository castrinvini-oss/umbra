"use client";

import { ExternalLink, Plus, RotateCcw, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ImageField } from "@/components/admin/media-picker";
import { SitePreview } from "@/components/admin/site-preview";
import { Segmented } from "@/components/ui/overlay";
import { Button, Field, Input, PageHeader, Select, Switch, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { DEFAULT_SITE, SITE_SECTIONS, type SiteConfig, type SiteSection } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { SiteEditorData } from "@/server/services/site-editor.service";

export type Panel = "identity" | "profile" | "social" | "texts" | "benefits" | "seo" | "colors" | "layout" | "banner" | "content" | "buttons";

const PANEL_LABELS: Record<Panel, string> = {
  identity: "Identidade",
  profile: "Perfil",
  social: "Links sociais",
  texts: "Textos da página",
  benefits: "Benefícios",
  seo: "SEO",
  colors: "Cores",
  layout: "Layout",
  banner: "Banner",
  content: "Conteúdo",
  buttons: "Botões",
};

const PRESETS: { name: string; theme: Partial<SiteConfig["theme"]> }[] = [
  { name: "Umbra", theme: { primary: "#E7B77A", secondary: "#C86B85", background: "#0A090D", surface: "#141218", text: "#F2EEE7", muted: "#9A94A3" } },
  { name: "Vinho", theme: { primary: "#E4577A", secondary: "#F0A36B", background: "#0D0709", surface: "#1A0F13", text: "#F7ECEE", muted: "#A48E94" } },
  { name: "Esmeralda", theme: { primary: "#4FD1A5", secondary: "#8B9CF7", background: "#07100D", surface: "#0F1B17", text: "#E9F5F0", muted: "#8BA39A" } },
  { name: "Grafite", theme: { primary: "#F2F2F2", secondary: "#9AA7FF", background: "#0B0B0C", surface: "#161618", text: "#F5F5F5", muted: "#9A9AA0" } },
];

type Profile = SiteEditorData["profile"];

export function SiteEditor({
  data,
  panels,
  title,
  eyebrow,
  description,
  previewFocus = "full",
}: {
  data: SiteEditorData;
  panels: Panel[];
  title: string;
  eyebrow: string;
  description: string;
  previewFocus?: "full" | "hero";
}) {
  const [site, setSite] = useState<SiteConfig>(data.site);
  const [profile, setProfile] = useState<Profile>(data.profile);
  const [urls, setUrls] = useState(data.urls);
  const [panel, setPanel] = useState<Panel>(panels[0]!);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState({ site: data.site, profile: data.profile });
  const router = useRouter();
  const toast = useToast();

  const dirtySections = useMemo(
    () => SITE_SECTIONS.filter((s) => JSON.stringify(site[s]) !== JSON.stringify(baseline.site[s])),
    [site, baseline],
  );
  const profileDirty = JSON.stringify(profile) !== JSON.stringify(baseline.profile);
  const dirty = dirtySections.length > 0 || profileDirty;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <S extends SiteSection, K extends keyof SiteConfig[S]>(section: S, key: K, value: SiteConfig[S][K]) =>
    setSite((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  const setP = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((p) => ({ ...p, [key]: value }));

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      if (dirtySections.length) {
        await api("/api/admin/site", { method: "PUT", body: { sections: Object.fromEntries(dirtySections.map((s) => [s, site[s]])) } });
      }
      if (profileDirty) {
        await api("/api/profile", { method: "PUT", body: { ...profile, location: profile.location || null } });
      }
      setBaseline({ site, profile });
      toast.success("Alterações salvas", "O site público já reflete as mudanças.");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError) setErrors(e.fields ?? {});
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const heroProfile = {
    ...profile,
    avatarUrl: urls.avatar,
    bannerUrl: urls.banner,
    subscriberCount: profile.showSubscriberCount ? data.subscriberCount : null,
  };

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <>
            <Button href="/" external variant="outline" size="sm">
              <ExternalLink className="h-4 w-4" /> Visualizar site
            </Button>
            <Button onClick={save} loading={saving} disabled={!dirty} variant="glow" size="sm">
              <Save className="h-4 w-4" /> Salvar alterações
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="min-w-0">
          {panels.length > 1 && (
            <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
              {panels.map((p) => (
                <button key={p} onClick={() => setPanel(p)} className={cn("chip shrink-0 py-1.5", panel === p && "chip-active")}>
                  {PANEL_LABELS[p]}
                </button>
              ))}
            </div>
          )}

          <div className="card card-pad space-y-5">
            {panel === "identity" && (
              <>
                <Field label="Nome do site">
                  <Input value={site.identity.siteName} onChange={(e) => set("identity", "siteName", e.target.value)} maxLength={40} />
                </Field>
                <Field label="Slogan">
                  <Input value={site.identity.tagline} onChange={(e) => set("identity", "tagline", e.target.value)} maxLength={120} />
                </Field>
                <ImageField
                  label="Logo"
                  hint="PNG com fundo transparente. Sem logo, usamos o nome do site."
                  value={site.identity.logoMediaId}
                  url={urls.logo}
                  aspect="aspect-[3/1]"
                  onChange={(id, url) => {
                    set("identity", "logoMediaId", id);
                    setUrls((u) => ({ ...u, logo: url }));
                  }}
                />
                <ImageField
                  label="Favicon"
                  hint="Quadrado, 512×512 px recomendado."
                  value={site.identity.faviconMediaId}
                  url={urls.favicon}
                  aspect="aspect-square"
                  onChange={(id, url) => {
                    set("identity", "faviconMediaId", id);
                    setUrls((u) => ({ ...u, favicon: url }));
                  }}
                />
              </>
            )}

            {panel === "profile" && (
              <>
                <ImageField
                  label="Foto de perfil"
                  value={profile.avatarMediaId}
                  url={urls.avatar}
                  round
                  onChange={(id, url) => {
                    setP("avatarMediaId", id);
                    setUrls((u) => ({ ...u, avatar: url }));
                  }}
                />
                {!panels.includes("banner") && (
                  <ImageField
                    label="Banner"
                    hint="1920×640 px recomendado."
                    value={profile.bannerMediaId}
                    url={urls.banner}
                    aspect="aspect-[3/1]"
                    onChange={(id, url) => {
                      setP("bannerMediaId", id);
                      setUrls((u) => ({ ...u, banner: url }));
                    }}
                  />
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome" error={errors.displayName}>
                    <Input value={profile.displayName} onChange={(e) => setP("displayName", e.target.value)} />
                  </Field>
                  <Field label="Username" error={errors.username}>
                    <Input value={profile.username} onChange={(e) => setP("username", e.target.value.toLowerCase())} />
                  </Field>
                </div>
                <Field label="Frase de destaque">
                  <Input value={profile.headline} onChange={(e) => setP("headline", e.target.value)} maxLength={120} />
                </Field>
                <Field label="Bio" hint={`${profile.bio.length}/1000`}>
                  <Textarea rows={5} value={profile.bio} onChange={(e) => setP("bio", e.target.value)} maxLength={1000} />
                </Field>
                <Field label="Localização (opcional)">
                  <Input value={profile.location ?? ""} onChange={(e) => setP("location", e.target.value)} />
                </Field>
                <Switch checked={profile.verified} onChange={(v) => setP("verified", v)} label="Selo de verificação" />
                <Switch checked={profile.showSubscriberCount} onChange={(v) => setP("showSubscriberCount", v)} label="Exibir número de assinantes" />
              </>
            )}

            {panel === "social" && (
              <ListEditor
                items={profile.socialLinks}
                onChange={(v) => setP("socialLinks", v)}
                empty={{ label: "", url: "https://" }}
                render={(item, update) => (
                  <div className="grid flex-1 gap-2 sm:grid-cols-[120px_1fr]">
                    <Input value={item.label} onChange={(e) => update({ ...item, label: e.target.value })} placeholder="Instagram" />
                    <Input value={item.url} onChange={(e) => update({ ...item, url: e.target.value })} placeholder="https://" />
                  </div>
                )}
                addLabel="Adicionar link"
              />
            )}

            {panel === "texts" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Título do feed">
                    <Input value={site.texts.feedTitle} onChange={(e) => set("texts", "feedTitle", e.target.value)} />
                  </Field>
                  <Field label="Título dos planos">
                    <Input value={site.texts.plansTitle} onChange={(e) => set("texts", "plansTitle", e.target.value)} />
                  </Field>
                </div>
                <Field label="Subtítulo dos planos">
                  <Input value={site.texts.plansSubtitle} onChange={(e) => set("texts", "plansSubtitle", e.target.value)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Selo de bloqueado">
                    <Input value={site.texts.lockedLabel} onChange={(e) => set("texts", "lockedLabel", e.target.value)} />
                  </Field>
                  <Field label="Botão de desbloqueio">
                    <Input value={site.texts.unlockLabel} onChange={(e) => set("texts", "unlockLabel", e.target.value)} />
                  </Field>
                </div>
                <Field label="Rodapé">
                  <Input value={site.texts.footerText} onChange={(e) => set("texts", "footerText", e.target.value)} />
                </Field>
                <Field label="Título da tela +18">
                  <Input value={site.texts.ageGateTitle} onChange={(e) => set("texts", "ageGateTitle", e.target.value)} />
                </Field>
                <Field label="Texto da tela +18">
                  <Textarea rows={3} value={site.texts.ageGateText} onChange={(e) => set("texts", "ageGateText", e.target.value)} />
                </Field>
                {!panels.includes("buttons") && <ButtonFields site={site} set={set} />}
              </>
            )}

            {panel === "benefits" && (
              <>
                <Field label="Título da seção">
                  <Input value={site.texts.benefitsTitle} onChange={(e) => set("texts", "benefitsTitle", e.target.value)} />
                </Field>
                <ListEditor
                  items={site.texts.benefits}
                  onChange={(v) => set("texts", "benefits", v)}
                  empty=""
                  render={(item, update) => <Input value={item} onChange={(e) => update(e.target.value)} placeholder="Ex.: Conteúdo exclusivo" />}
                  addLabel="Adicionar benefício"
                />
              </>
            )}

            {panel === "seo" && (
              <>
                <Field label="Meta title" hint={`${site.seo.title.length}/70`}>
                  <Input value={site.seo.title} onChange={(e) => set("seo", "title", e.target.value)} maxLength={70} />
                </Field>
                <Field label="Meta description" hint={`${site.seo.description.length}/170`}>
                  <Textarea rows={3} value={site.seo.description} onChange={(e) => set("seo", "description", e.target.value)} maxLength={170} />
                </Field>
                <Field label="Palavras-chave">
                  <Input value={site.seo.keywords} onChange={(e) => set("seo", "keywords", e.target.value)} />
                </Field>
                <Field label="Usuário no X/Twitter">
                  <Input value={site.seo.twitterHandle} onChange={(e) => set("seo", "twitterHandle", e.target.value)} placeholder="@perfil" />
                </Field>
                <ImageField
                  label="Imagem Open Graph"
                  hint="1200×630 px. Exibida ao compartilhar o link."
                  value={site.seo.ogImageMediaId}
                  url={urls.og}
                  onChange={(id, url) => {
                    set("seo", "ogImageMediaId", id);
                    setUrls((u) => ({ ...u, og: url }));
                  }}
                />
                <div className="rounded-field border border-line bg-bg/40 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted">Prévia no buscador</p>
                  <p className="mt-2 truncate text-[15px] text-[#8ab4f8]">{site.seo.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{site.seo.description}</p>
                </div>
              </>
            )}

            {panel === "colors" && (
              <>
                <div>
                  <p className="label">Paletas prontas</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setSite((s) => ({ ...s, theme: { ...s.theme, ...p.theme } }))}
                        className="flex items-center gap-2 rounded-field border border-line px-3 py-2 text-sm transition hover:border-ink/25"
                      >
                        <span className="flex -space-x-1">
                          {[p.theme.background, p.theme.primary, p.theme.secondary].map((c) => (
                            <span key={c} className="h-4 w-4 rounded-full border border-white/10" style={{ background: c }} />
                          ))}
                        </span>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                {(
                  [
                    ["primary", "Cor principal"],
                    ["secondary", "Cor secundária"],
                    ["background", "Fundo"],
                    ["surface", "Superfície (cards)"],
                    ["text", "Texto"],
                    ["muted", "Texto secundário"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={site.theme[key]}
                      onChange={(e) => set("theme", key, e.target.value.toUpperCase())}
                      className="h-10 w-12 cursor-pointer rounded-field border border-line bg-transparent p-1"
                      aria-label={label}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{label}</p>
                    </div>
                    <Input
                      value={site.theme[key]}
                      onChange={(e) => set("theme", key, e.target.value)}
                      className="h-9 w-28 font-mono text-xs uppercase"
                      invalid={!!errors[key]}
                    />
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSite((s) => ({ ...s, theme: { ...s.theme, ...DEFAULT_SITE.theme, radius: s.theme.radius, density: s.theme.density, cardStyle: s.theme.cardStyle, buttonStyle: s.theme.buttonStyle } }))}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar cores padrão
                </Button>
              </>
            )}

            {panel === "layout" && (
              <>
                <Field label="Estilo dos cards">
                  <Segmented
                    value={site.theme.cardStyle}
                    onChange={(v) => set("theme", "cardStyle", v)}
                    options={[
                      { value: "glass", label: "Vidro" },
                      { value: "solid", label: "Sólido" },
                      { value: "outline", label: "Contorno" },
                    ]}
                  />
                </Field>
                <Field label={`Arredondamento · ${site.theme.radius}px`}>
                  <input type="range" min={0} max={28} value={site.theme.radius} onChange={(e) => set("theme", "radius", Number(e.target.value))} className="w-full" style={{ accentColor: "rgb(var(--c-primary))" }} />
                </Field>
                <Field label="Espaçamento">
                  <Segmented
                    value={site.theme.density}
                    onChange={(v) => set("theme", "density", v)}
                    options={[
                      { value: "compact", label: "Compacto" },
                      { value: "comfortable", label: "Confortável" },
                      { value: "spacious", label: "Amplo" },
                    ]}
                  />
                </Field>
                <Field label="Feed">
                  <Segmented
                    value={site.layout.feedLayout}
                    onChange={(v) => set("layout", "feedLayout", v)}
                    options={[
                      { value: "grid", label: "Grade" },
                      { value: "list", label: "Lista" },
                    ]}
                  />
                </Field>
                {!panels.includes("banner") && <BannerFields site={site} set={set} compact />}
                <Switch checked={site.layout.showStats} onChange={(v) => set("layout", "showStats", v)} label="Mostrar estatísticas (posts, fotos, vídeos)" />
                <Switch checked={site.layout.showFeedPreview} onChange={(v) => set("layout", "showFeedPreview", v)} label="Mostrar prévia do feed na página inicial" />
                <Switch checked={site.layout.showPlansOnHome} onChange={(v) => set("layout", "showPlansOnHome", v)} label="Mostrar planos na página inicial" />
              </>
            )}

            {panel === "banner" && (
              <>
                <ImageField
                  label="Imagem do banner"
                  hint="1920×640 px recomendado. JPG ou WEBP."
                  value={profile.bannerMediaId}
                  url={urls.banner}
                  aspect="aspect-[3/1]"
                  onChange={(id, url) => {
                    setP("bannerMediaId", id);
                    setUrls((u) => ({ ...u, banner: url }));
                  }}
                />
                <BannerFields site={site} set={set} />
                <div className="border-t border-line pt-5">
                  <Switch
                    checked={site.banner.announcementEnabled}
                    onChange={(v) => set("banner", "announcementEnabled", v)}
                    label="Faixa de anúncio no topo"
                    description="Ideal para promoções e novidades."
                  />
                  {site.banner.announcementEnabled && (
                    <div className="mt-4 space-y-4">
                      <Field label="Texto da faixa">
                        <Input value={site.banner.announcementText} onChange={(e) => set("banner", "announcementText", e.target.value)} maxLength={140} />
                      </Field>
                      <Field label="Link (opcional)" error={errors.announcementLink}>
                        <Input value={site.banner.announcementLink} onChange={(e) => set("banner", "announcementLink", e.target.value)} placeholder="/planos" />
                      </Field>
                    </div>
                  )}
                </div>
              </>
            )}

            {panel === "content" && (
              <>
                <div>
                  <p className="label">Categorias em destaque no feed público</p>
                  <div className="flex flex-wrap gap-2">
                    {data.categories.map((c) => {
                      const on = site.layout.featuredCategoryIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            set("layout", "featuredCategoryIds", on ? site.layout.featuredCategoryIds.filter((x) => x !== c.id) : [...site.layout.featuredCategoryIds, c.id])
                          }
                          className={cn("chip", on && "chip-active")}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="hint">Nenhuma selecionada = todas as categorias aparecem como filtro.</p>
                </div>
                <div className="rounded-field border border-line bg-bg/40 p-4 text-sm text-muted">
                  Posts fixados e destaques são definidos em cada publicação.{" "}
                  <a href="/admin/conteudos" className="font-semibold text-primary hover:underline">
                    Gerenciar conteúdos
                  </a>
                </div>
              </>
            )}

            {panel === "buttons" && <ButtonFields site={site} set={set} withStyle />}
          </div>
          {dirty && <p className="mt-3 text-xs text-warning">Alterações não salvas.</p>}
        </div>

        <div className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <p className="eyebrow mb-2">Preview em tempo real</p>
          <SitePreview site={site} profile={heroProfile} plans={data.plans} stats={data.stats} logoUrl={urls.logo} focus={previewFocus} />
        </div>
      </div>
    </div>
  );
}

type Setter = <S extends SiteSection, K extends keyof SiteConfig[S]>(section: S, key: K, value: SiteConfig[S][K]) => void;

function ButtonFields({ site, set, withStyle }: { site: SiteConfig; set: Setter; withStyle?: boolean }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Texto do botão principal">
          <Input value={site.texts.ctaLabel} onChange={(e) => set("texts", "ctaLabel", e.target.value)} />
        </Field>
        <Field label="Link do botão principal">
          <Input value={site.texts.ctaLink} onChange={(e) => set("texts", "ctaLink", e.target.value)} placeholder="/planos" />
        </Field>
      </div>
      <Field label="Estilo do botão principal">
        <Segmented
          value={site.texts.ctaStyle}
          onChange={(v) => set("texts", "ctaStyle", v)}
          options={[
            { value: "glow", label: "Brilho" },
            { value: "solid", label: "Sólido" },
            { value: "outline", label: "Contorno" },
          ]}
        />
      </Field>
      <Field label="Texto do botão Entrar">
        <Input value={site.texts.loginLabel} onChange={(e) => set("texts", "loginLabel", e.target.value)} />
      </Field>
      {withStyle && (
        <Field label="Formato dos botões">
          <Segmented
            value={site.theme.buttonStyle}
            onChange={(v) => set("theme", "buttonStyle", v)}
            options={[
              { value: "pill", label: "Pílula" },
              { value: "rounded", label: "Arredondado" },
              { value: "square", label: "Reto" },
            ]}
          />
        </Field>
      )}
    </>
  );
}

function BannerFields({ site, set, compact }: { site: SiteConfig; set: Setter; compact?: boolean }) {
  return (
    <>
      <Field label="Altura do banner">
        <Segmented
          value={site.banner.height}
          onChange={(v) => set("banner", "height", v)}
          options={[
            { value: "sm", label: "Baixo" },
            { value: "md", label: "Médio" },
            { value: "lg", label: "Alto" },
          ]}
        />
      </Field>
      {!compact && (
        <>
          <Field label={`Escurecimento · ${site.banner.overlay}%`}>
            <input type="range" min={0} max={90} value={site.banner.overlay} onChange={(e) => set("banner", "overlay", Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="Enquadramento da imagem">
            <Select value={site.banner.position} onChange={(e) => set("banner", "position", e.target.value as SiteConfig["banner"]["position"])}>
              <option value="top">Topo</option>
              <option value="center">Centro</option>
              <option value="bottom">Base</option>
            </Select>
          </Field>
        </>
      )}
      <Field label="Largura">
        <Segmented
          value={site.banner.style}
          onChange={(v) => set("banner", "style", v)}
          options={[
            { value: "full", label: "Tela cheia" },
            { value: "contained", label: "Contido" },
          ]}
        />
      </Field>
    </>
  );
}

function ListEditor<T>({
  items,
  onChange,
  empty,
  render,
  addLabel,
}: {
  items: T[];
  onChange: (v: T[]) => void;
  empty: T;
  render: (item: T, update: (v: T) => void) => React.ReactNode;
  addLabel: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">{render(item, (v) => onChange(items.map((x, j) => (j === i ? v : x))))}</div>
          <Button variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remover">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="soft" onClick={() => onChange([...items, empty])}>
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </Button>
    </div>
  );
}
