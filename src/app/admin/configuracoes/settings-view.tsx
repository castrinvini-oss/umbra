"use client";

import { CheckCircle2, KeyRound, Mail, Plug, Plus, ScrollText, Server, ShieldCheck, Users, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SecuritySettings } from "@/components/account/security-settings";
import { CopyButton, Modal } from "@/components/ui/overlay";
import { Badge, Button, Checkbox, EmptyState, Field, Input, PageHeader, Select, Switch } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/api-client";
import { GATEWAY_LABELS, GATEWAYS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, ROLE_LABELS, type GatewayName, type PaymentMethod, type Role } from "@/lib/constants";
import { dateTime, relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { listAdminLogs } from "@/server/services/admin-queries.service";
import type { getPaymentConfigMasked } from "@/server/services/settings.service";

type PaymentMasked = Awaited<ReturnType<typeof getPaymentConfigMasked>>;
type Log = Awaited<ReturnType<typeof listAdminLogs>>[number];
type TeamMember = { id: string; name: string; email: string; role: string; status: string; twoFactorEnabled: boolean; lastLoginAt: string | null; createdAt: string };
type EmailRow = { id: string; to: string; template: string; subject: string; provider: string; status: string; error: string | null; createdAt: string };

const TABS = [
  { value: "pagamentos", label: "Pagamentos", icon: Plug },
  { value: "seguranca", label: "Segurança", icon: ShieldCheck },
  { value: "equipe", label: "Equipe", icon: Users },
  { value: "emails", label: "E-mails", icon: Mail },
  { value: "logs", label: "Logs administrativos", icon: ScrollText },
  { value: "sistema", label: "Sistema", icon: Server },
];

const GATEWAY_HELP: Record<GatewayName, { api: string; secret: string; webhook: string; note: string }> = {
  mock: {
    api: "Não utilizado",
    secret: "Não utilizado",
    webhook: "Segredo HMAC dos webhooks simulados (opcional)",
    note: "Gateway de demonstração: permite testar todo o fluxo (cobrança → webhook assinado → assinatura ativa) sem cobrança real. Disponível somente com DEMO_MODE=true.",
  },
  misticpay: {
    api: "Client ID da chave de acesso (pk_...) — MisticPay → API → Chaves de Acesso",
    secret: "Client Secret da chave de acesso (sk_...) — aparece uma única vez ao criar a chave",
    webhook: "Invente um token aleatório (letras e números). Ele protege a URL do webhook",
    note: "Somente PIX. Não é preciso cadastrar webhook na MisticPay: a URL segura é enviada em cada cobrança. O status é sempre confirmado na API da MisticPay antes de liberar acesso. A MisticPay não tem sandbox — o modo é ignorado. Reembolsos são feitos pelo painel da MisticPay.",
  },
  asaas: {
    api: "Chave de API ($aact_...) — Minha conta → Integrações",
    secret: "Não utilizado pelo Asaas",
    webhook: "Token de autenticação definido ao cadastrar o webhook no Asaas",
    note: "Cadastre o webhook no painel do Asaas com a URL abaixo, eventos de Cobrança, e o mesmo token informado aqui.",
  },
  mercadopago: {
    api: "Access Token (TEST-... ou APP_USR-...)",
    secret: "Public Key (opcional, reservado para checkout transparente)",
    webhook: "Assinatura secreta — Suas integrações → Webhooks",
    note: "Em Suas integrações → Webhooks, informe a URL abaixo e marque os eventos Pagamentos e Planos e assinaturas.",
  },
};

export function SettingsView(props: {
  initialTab: string;
  payment: PaymentMasked;
  webhookUrl: string;
  team: TeamMember[];
  logs: Log[];
  emails: EmailRow[];
  templates: { id: string; label: string }[];
  twoFactorEnabled: boolean;
  system: { demoMode: boolean; appUrl: string; storage: string; emailDriver: string; maxImageMb: number; maxVideoMb: number; database: string; cronConfigured: boolean };
}) {
  const [tab, setTab] = useState(TABS.some((t) => t.value === props.initialTab) ? props.initialTab : "pagamentos");
  return (
    <div>
      <PageHeader eyebrow="Sistema" title="Configurações" description="Gateway de pagamento, segurança, equipe, e-mails e auditoria." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:px-0">
          {TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => {
                setTab(value);
                window.history.replaceState(null, "", `?tab=${value}`);
              }}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-field px-3 py-2 text-sm font-medium transition",
                tab === value ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink",
              )}
            >
              <Icon className={cn("h-4 w-4", tab === value && "text-primary")} />
              {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === "pagamentos" && <PaymentSettings initial={props.payment} webhookUrl={props.webhookUrl} demoMode={props.system.demoMode} />}
          {tab === "seguranca" && (
            <div className="max-w-2xl space-y-6">
              <SecuritySettings twoFactorEnabled={props.twoFactorEnabled} />
              <div className="card card-pad text-sm text-muted">
                <p className="font-semibold text-ink">Proteções ativas</p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    "Senhas com bcrypt (custo 12)",
                    "Sessões httpOnly com expiração",
                    "Proteção CSRF (double submit + Origin)",
                    "Rate limiting em login, cadastro, checkout e webhooks",
                    "Validação de upload por conteúdo (anti MIME spoofing)",
                    "Limite de tamanho de arquivos",
                    "Remoção de metadados EXIF/GPS das imagens",
                    "Mídia privada fora da pasta pública + URL assinada",
                    "Credenciais do gateway criptografadas (AES-256-GCM)",
                    "Permissões por papel e log administrativo",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {tab === "equipe" && <TeamSettings team={props.team} />}
          {tab === "emails" && <EmailSettings emails={props.emails} templates={props.templates} driver={props.system.emailDriver} />}
          {tab === "logs" && <LogsView logs={props.logs} />}
          {tab === "sistema" && <SystemInfo system={props.system} webhookUrl={props.webhookUrl} />}
        </div>
      </div>
    </div>
  );
}

function SecretInput({ label, hint, mask, value, onChange, disabled }: { label: string; hint: string; mask: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Field label={label} hint={mask ? `Salvo: ${mask} — deixe vazio para manter. ${hint}` : hint}>
      <Input type="password" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder={mask ? "••••••••" : "Não configurado"} disabled={disabled} />
    </Field>
  );
}

function PaymentSettings({ initial, webhookUrl, demoMode }: { initial: PaymentMasked; webhookUrl: string; demoMode: boolean }) {
  const [gateway, setGateway] = useState<GatewayName>(initial.gateway);
  const [mode, setMode] = useState(initial.mode);
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [methods, setMethods] = useState<PaymentMethod[]>(initial.enabledMethods);
  const [requireCpf, setRequireCpf] = useState(initial.requireCpf);
  const [masks, setMasks] = useState(initial);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const toast = useToast();
  const help = GATEWAY_HELP[gateway];
  const sameGateway = gateway === masks.gateway;

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      setResult(await api("/api/admin/settings/payment", { method: "POST", body: { config: { gateway, mode, apiKey, secretKey, webhookSecret } } }));
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const r = await api<{ config: PaymentMasked }>("/api/admin/settings/payment", {
        method: "PUT",
        body: { gateway, mode, apiKey, secretKey, webhookSecret, enabledMethods: methods, requireCpf },
      });
      setMasks(r.config);
      setApiKey("");
      setSecretKey("");
      setWebhookSecret("");
      toast.success("Configuração de pagamento salva", "Credenciais armazenadas criptografadas.");
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="card card-pad space-y-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-semibold">
            <KeyRound className="h-4 w-4 text-primary" /> Gateway de pagamento
          </p>
          <Badge tone={masks.source === "panel" ? "success" : "neutral"}>{masks.source === "panel" ? "Configurado no painel" : "Usando .env"}</Badge>
        </div>
        <Field label="Gateway">
          <Select value={gateway} onChange={(e) => setGateway(e.target.value as GatewayName)}>
            {GATEWAYS.map((g) => (
              <option key={g} value={g} disabled={g === "mock" && !demoMode}>
                {GATEWAY_LABELS[g]}
                {g === "mock" && !demoMode ? " (requer DEMO_MODE)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <p className="rounded-field bg-surface-2/60 px-3 py-2.5 text-xs leading-relaxed text-muted">{help.note}</p>

        <SecretInput label="API KEY" hint={help.api} mask={sameGateway ? masks.apiKeyMask : ""} value={apiKey} onChange={setApiKey} disabled={gateway === "mock"} />
        <SecretInput label="SECRET KEY" hint={help.secret} mask={sameGateway ? masks.secretKeyMask : ""} value={secretKey} onChange={setSecretKey} disabled={gateway !== "mercadopago" && gateway !== "misticpay"} />
        <SecretInput label="WEBHOOK SECRET" hint={help.webhook} mask={sameGateway ? masks.webhookSecretMask : ""} value={webhookSecret} onChange={setWebhookSecret} />

        <div>
          <p className="label">Modo</p>
          <div className="flex gap-4">
            {(["sandbox", "production"] as const).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} style={{ accentColor: "rgb(var(--c-primary))" }} />
                {m === "sandbox" ? "Sandbox" : "Produção"}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="label">Métodos habilitados no checkout</p>
          <div className="flex flex-wrap gap-4">
            {PAYMENT_METHODS.map((m) => (
              <Checkbox key={m} checked={methods.includes(m)} onChange={(v) => setMethods((l) => (v ? [...l, m] : l.filter((x) => x !== m)))}>
                {PAYMENT_METHOD_LABELS[m]}
              </Checkbox>
            ))}
          </div>
        </div>
        <Switch checked={requireCpf} onChange={setRequireCpf} label="Exigir CPF no checkout" description="Necessário para alguns gateways/métodos (ex.: PIX no Asaas)." />

        <Field label="URL do webhook (cadastre no gateway)">
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <CopyButton value={webhookUrl} />
          </div>
        </Field>

        {result && (
          <p className={cn("flex items-start gap-2 rounded-field px-3 py-2.5 text-sm", result.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
            {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            {result.message}
          </p>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line pt-5">
          <Button variant="outline" onClick={test} loading={testing}>
            Testar conexão
          </Button>
          <Button onClick={save} loading={saving} disabled={!methods.length}>
            Salvar
          </Button>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Importante: confirme com o gateway escolhido que a categoria de negócio (conteúdo adulto) é aceita pelos termos de uso dele antes de operar em
        produção. Processadores especializados podem ser integrados implementando a interface <code className="font-mono">PaymentGateway</code>.
      </p>
    </div>
  );
}

function TeamSettings({ team }: { team: TeamMember[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "MODERATOR" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function create() {
    setSaving(true);
    setErrors({});
    try {
      await api("/api/admin/team", { method: "POST", body: form });
      toast.success("Membro criado");
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "MODERATOR" });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError) setErrors(e.fields ?? {});
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-muted">
          <b className="text-ink">Administrador</b> acesso total · <b className="text-ink">Moderador</b> denúncias e assinantes (leitura) · <b className="text-ink">Creator</b> conteúdo e site
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Papel</th>
              <th>2FA</th>
              <th>Último login</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id}>
                <td>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted">{m.email}</p>
                </td>
                <td>
                  <Badge tone="primary">{ROLE_LABELS[m.role as Role]}</Badge>
                </td>
                <td>{m.twoFactorEnabled ? <Badge tone="success">Ativo</Badge> : <Badge>Não</Badge>}</td>
                <td className="text-muted">{m.lastLoginAt ? relative(m.lastLoginAt) : "—"}</td>
                <td>
                  <Badge tone={m.status === "ACTIVE" ? "success" : "danger"} dot>
                    {m.status === "ACTIVE" ? "Ativo" : m.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo membro da equipe"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={create} loading={saving}>
              Criar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome" error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="E-mail" error={errors.email}>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Senha inicial" hint="Mínimo 10 caracteres, com letras e números" error={errors.password}>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Papel">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="MODERATOR">Moderador</option>
              <option value="CREATOR">Creator</option>
              <option value="ADMIN">Administrador</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function EmailSettings({ emails, templates, driver }: { emails: EmailRow[]; templates: { id: string; label: string }[]; driver: string }) {
  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Templates transacionais</p>
          <Badge tone={driver === "smtp" ? "success" : "warning"}>{driver === "smtp" ? "Envio via SMTP" : "Modo console (sem envio real)"}</Badge>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-field border border-line px-3 py-2 text-sm">
              <Mail className="h-4 w-4 text-primary" /> {t.label}
              <code className="ml-auto text-[10px] text-muted">{t.id}</code>
            </div>
          ))}
        </div>
        <p className="hint mt-3">Edite os textos em src/server/email/templates.ts. Configure EMAIL_DRIVER=smtp e as variáveis SMTP_* para envio real.</p>
      </div>
      <div className="card overflow-x-auto">
        {emails.length === 0 ? (
          <EmptyState title="Nenhum e-mail registrado" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Destinatário</th>
                <th>Assunto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-xs text-muted">{dateTime(e.createdAt)}</td>
                  <td>{e.to}</td>
                  <td>
                    {e.subject}
                    <p className="text-[11px] text-muted">{templates.find((t) => t.id === e.template)?.label}</p>
                  </td>
                  <td>
                    <Badge tone={e.status === "SENT" ? "success" : e.status === "FAILED" ? "danger" : "neutral"}>{e.status}</Badge>
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

function LogsView({ logs }: { logs: Log[] }) {
  return (
    <div className="card overflow-x-auto">
      {logs.length === 0 ? (
        <EmptyState title="Nenhuma ação registrada" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Autor</th>
              <th>Ação</th>
              <th>Detalhes</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs text-muted">{dateTime(l.createdAt)}</td>
                <td>{l.actorName}</td>
                <td>
                  {l.label}
                  <p className="font-mono text-[10px] text-muted">{l.action}</p>
                </td>
                <td className="max-w-[280px] truncate font-mono text-[11px] text-muted" title={JSON.stringify(l.metadata)}>
                  {l.entityType ? `${l.entityType}:${l.entityId?.slice(0, 10)} ` : ""}
                  {Object.keys(l.metadata).length ? JSON.stringify(l.metadata) : ""}
                </td>
                <td className="text-xs text-muted">{l.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SystemInfo({ system, webhookUrl }: { system: { demoMode: boolean; appUrl: string; storage: string; emailDriver: string; maxImageMb: number; maxVideoMb: number; database: string; cronConfigured: boolean }; webhookUrl: string }) {
  const rows: [string, React.ReactNode][] = [
    ["Modo Demo", system.demoMode ? <Badge tone="warning">Ativo (DEMO_MODE=true)</Badge> : <Badge tone="success">Desativado</Badge>],
    ["URL da aplicação", <code key="u" className="font-mono text-xs">{system.appUrl}</code>],
    ["Banco de dados", system.database],
    [
      "Armazenamento de mídia",
      system.storage === "supabase" ? "Supabase Storage (upload direto + URLs assinadas)" : system.storage === "s3" ? "S3 compatível (URLs pré-assinadas)" : "Disco local protegido",
    ],
    ["Limites de upload", `Imagens ${system.maxImageMb} MB · Vídeos ${system.maxVideoMb} MB`],
    ["E-mail", system.emailDriver === "smtp" ? "SMTP" : "Console (log)"],
    ["Webhook", <code key="w" className="font-mono text-xs">{webhookUrl}</code>],
    ["Job de assinaturas", system.cronConfigured ? "CRON_SECRET configurado" : <Badge tone="warning">Defina CRON_SECRET</Badge>],
  ];
  return (
    <div className="card max-w-3xl divide-y divide-line/60">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted">{k}</span>
          <span className="text-sm">{v}</span>
        </div>
      ))}
      <p className="px-5 py-4 text-xs leading-relaxed text-muted">
        Essas opções vêm de variáveis de ambiente (.env) e exigem reinício do servidor. Agende o job a cada hora:{" "}
        <code className="font-mono">POST /api/cron/subscriptions</code> com <code className="font-mono">Authorization: Bearer $CRON_SECRET</code>.
      </p>
    </div>
  );
}
