"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/overlay";
import { Button, Field, Input, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export function ReportDialog({ open, onClose, contentId, loggedIn }: { open: boolean; onClose: () => void; contentId?: string; loggedIn: boolean }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function submit() {
    if (!reason) return toast.error("Selecione um motivo");
    setLoading(true);
    try {
      await api("/api/reports", { method: "POST", body: { contentId, reason, details, email: loggedIn ? undefined : email } });
      toast.success("Denúncia enviada", "Nossa equipe vai analisar com prioridade.");
      setReason(null);
      setDetails("");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Denunciar conteúdo"
      description="Denúncias são confidenciais e analisadas pela moderação."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={submit} loading={loading}>
            Enviar denúncia
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {REPORT_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={cn(
              "w-full rounded-field border px-3.5 py-2.5 text-left text-sm transition",
              reason === r ? "border-danger/60 bg-danger/10 text-ink" : "border-line text-ink/80 hover:border-ink/20",
            )}
          >
            {REPORT_REASON_LABELS[r]}
          </button>
        ))}
      </div>
      <Field label="Detalhes (opcional)" className="mt-4">
        <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} placeholder="Descreva o problema" />
      </Field>
      {!loggedIn && (
        <Field label="Seu e-mail (opcional, para retorno)" className="mt-3">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      )}
    </Modal>
  );
}
