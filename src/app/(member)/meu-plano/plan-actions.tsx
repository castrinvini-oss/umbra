"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Button, Field, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import type { PaymentMethod } from "@/lib/constants";

export function PlanActions({ canCancel, canRenew, methods }: { canCancel: boolean; canRenew: boolean; methods: PaymentMethod[] }) {
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  async function cancel() {
    setLoading("cancel");
    try {
      await api("/api/subscription", { method: "POST", body: { action: "cancel", reason } });
      toast.success("Cancelamento agendado", "Você mantém o acesso até o fim do período.");
      setConfirm(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function renew() {
    setLoading("renew");
    try {
      const method = methods.includes("PIX") ? "PIX" : methods[0]!;
      const res = await api<{ redirect: string }>("/api/subscription", { method: "POST", body: { action: "renew", method } });
      window.location.assign(res.redirect);
    } catch (e) {
      toast.error((e as Error).message);
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
      <Button href="/planos" variant="outline">
        Trocar de plano
      </Button>
      {canRenew && (
        <Button variant="soft" onClick={renew} loading={loading === "renew"}>
          Renovar antecipadamente
        </Button>
      )}
      {canCancel && (
        <Button variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setConfirm(true)}>
          Cancelar assinatura
        </Button>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={cancel}
        loading={loading === "cancel"}
        danger
        title="Cancelar assinatura?"
        description="A renovação será interrompida. Você continua com acesso até o fim do período já pago."
        confirmLabel="Confirmar cancelamento"
      >
        <Field label="Quer contar o motivo? (opcional)" className="mt-4">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
