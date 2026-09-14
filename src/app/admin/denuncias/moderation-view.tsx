"use client";

import { AlertTriangle, EyeOff, Flag, ShieldBan } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Drawer, Tabs } from "@/components/ui/overlay";
import { Badge, Button, Checkbox, EmptyState, Field, PageHeader, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { CONTENT_STATUS_LABELS, REPORT_REASON_LABELS, REPORT_STATUS_LABELS, type ContentStatus, type ReportReason, type ReportStatus } from "@/lib/constants";
import { dateTime, relative } from "@/lib/format";
import { reportStatusTone } from "@/lib/tones";
import type { listReports } from "@/server/services/report.service";

type Report = Awaited<ReturnType<typeof listReports>>[number];

export function ModerationView({ reports }: { reports: Report[] }) {
  const [status, setStatus] = useState("open");
  const [selected, setSelected] = useState<Report | null>(null);
  const rows = useMemo(
    () => reports.filter((r) => (status === "open" ? ["OPEN", "REVIEWING"].includes(r.status) : status === "all" ? true : r.status === status)),
    [reports, status],
  );
  const urgent = reports.filter((r) => ["OPEN", "REVIEWING"].includes(r.status) && ["UNDERAGE", "ILLEGAL"].includes(r.reason)).length;

  return (
    <div>
      <PageHeader eyebrow="Conteúdo" title="Denúncias" description="Analise, remova conteúdo, suspenda contas e registre a resolução. Todas as ações ficam no log administrativo." />
      {urgent > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-card border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {urgent} denúncia(s) de possível ilegalidade ou envolvimento de menor aguardando análise. Trate com prioridade máxima e, se procedente,
          remova o conteúdo e comunique as autoridades competentes.
        </div>
      )}
      <Tabs
        className="mb-4"
        value={status}
        onChange={setStatus}
        tabs={[
          { value: "open", label: "Pendentes", count: reports.filter((r) => ["OPEN", "REVIEWING"].includes(r.status)).length },
          { value: "RESOLVED", label: "Resolvidas", count: reports.filter((r) => r.status === "RESOLVED").length },
          { value: "DISMISSED", label: "Descartadas", count: reports.filter((r) => r.status === "DISMISSED").length },
          { value: "all", label: "Todas", count: reports.length },
        ]}
      />
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState icon={<Flag className="h-5 w-5" />} title="Nenhuma denúncia aqui" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Recebida</th>
                <th>Motivo</th>
                <th>Conteúdo</th>
                <th>Denunciante</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                  <td className="whitespace-nowrap text-xs text-muted">{relative(r.createdAt)}</td>
                  <td>
                    <span className="flex items-center gap-1.5">
                      {["UNDERAGE", "ILLEGAL"].includes(r.reason) && <AlertTriangle className="h-3.5 w-3.5 text-danger" />}
                      {REPORT_REASON_LABELS[r.reason as ReportReason]}
                    </span>
                  </td>
                  <td className="max-w-[240px]">
                    {r.content ? (
                      <>
                        <p className="truncate">{r.content.title}</p>
                        <p className="text-[11px] text-muted">{CONTENT_STATUS_LABELS[r.content.status as ContentStatus]}</p>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="text-xs text-muted">{r.reporter?.email ?? r.reporterEmail ?? "Anônimo"}</td>
                  <td>
                    <Badge tone={reportStatusTone[r.status]}>{REPORT_STATUS_LABELS[r.status as ReportStatus]}</Badge>
                  </td>
                  <td className="text-right">
                    <Button size="sm" variant="soft">
                      Analisar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selected && <ReportDrawer report={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ReportDrawer({ report, onClose }: { report: Report; onClose: () => void }) {
  const [resolution, setResolution] = useState(report.resolution ?? "");
  const [removeContent, setRemoveContent] = useState(false);
  const [suspendUser, setSuspendUser] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const open = ["OPEN", "REVIEWING"].includes(report.status);

  async function submit(status: ReportStatus, key: string) {
    setBusy(key);
    try {
      await api(`/api/admin/reports/${report.id}`, { method: "PATCH", body: { status, resolution: resolution || undefined, removeContent, suspendUser } });
      toast.success("Denúncia atualizada");
      onClose();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Análise de denúncia"
      footer={
        open ? (
          <>
            {report.status === "OPEN" && (
              <Button variant="ghost" onClick={() => submit("REVIEWING", "review")} loading={busy === "review"}>
                Marcar em análise
              </Button>
            )}
            <Button variant="soft" onClick={() => submit("DISMISSED", "dismiss")} loading={busy === "dismiss"}>
              Descartar
            </Button>
            <Button variant={removeContent || suspendUser ? "danger" : "primary"} onClick={() => submit("RESOLVED", "resolve")} loading={busy === "resolve"}>
              Resolver
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={["UNDERAGE", "ILLEGAL"].includes(report.reason) ? "danger" : "warning"}>{REPORT_REASON_LABELS[report.reason as ReportReason]}</Badge>
          <Badge tone={reportStatusTone[report.status]}>{REPORT_STATUS_LABELS[report.status as ReportStatus]}</Badge>
          <span className="text-xs text-muted">{dateTime(report.createdAt)}</span>
        </div>
        <div>
          <p className="label">Detalhes informados</p>
          <p className="whitespace-pre-line rounded-field border border-line bg-bg/40 p-3 text-ink/85">{report.details || "Sem detalhes."}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Denunciante</p>
            <p className="mt-0.5">{report.reporter?.name ?? "Visitante"}</p>
            <p className="text-xs text-muted">{report.reporter?.email ?? report.reporterEmail ?? "sem e-mail"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Conteúdo</p>
            <p className="mt-0.5">{report.content?.title ?? "—"}</p>
            {report.content && <p className="text-xs text-muted">{CONTENT_STATUS_LABELS[report.content.status as ContentStatus]}</p>}
          </div>
        </div>
        {report.content && (
          <Button href="/admin/conteudos" variant="outline" size="sm">
            Abrir gerenciador de conteúdos
          </Button>
        )}

        {open ? (
          <>
            <Field label="Resolução / justificativa">
              <Textarea rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Descreva a análise e a decisão" />
            </Field>
            <div className="space-y-3 rounded-card border border-line p-4">
              {report.content && report.content.status !== "REMOVED" && (
                <Checkbox checked={removeContent} onChange={setRemoveContent}>
                  <span className="inline-flex items-center gap-1.5">
                    <EyeOff className="h-4 w-4" /> Remover o conteúdo imediatamente
                  </span>
                </Checkbox>
              )}
              {report.reportedUser && (
                <Checkbox checked={suspendUser} onChange={setSuspendUser}>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldBan className="h-4 w-4" /> Suspender a conta responsável ({report.reportedUser.email})
                  </span>
                </Checkbox>
              )}
              {!report.content && !report.reportedUser && <p className="text-xs text-muted">Sem conteúdo ou conta associados.</p>}
            </div>
          </>
        ) : (
          <div>
            <p className="label">Resolução</p>
            <p className="text-ink/85">{report.resolution || "—"}</p>
            <p className="mt-2 text-xs text-muted">
              Por {report.resolvedBy?.name ?? "—"} em {dateTime(report.resolvedAt)}
            </p>
          </div>
        )}
      </div>
    </Drawer>
  );
}
