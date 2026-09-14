"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type StatusResponse = { status: string; subscriptionStatus: string | null; accessUntil: string | null };

/**
 * Consulta periódica do status. A tela NUNCA libera acesso: apenas reflete o
 * que o webhook do gateway já gravou no banco.
 */
export function usePaymentStatus(paymentId: string, initial: string, intervalMs = 4000) {
  const [status, setStatus] = useState(initial);
  useEffect(() => {
    if (!["PENDING"].includes(status)) return;
    const timer = setInterval(async () => {
      try {
        const res = await api<StatusResponse>(`/api/payment/status?id=${paymentId}`);
        setStatus(res.status);
      } catch {
        /* silencioso: nova tentativa no próximo ciclo */
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [paymentId, status, intervalMs]);
  return status;
}

export function PaymentRedirector({ paymentId, initial }: { paymentId: string; initial: string }) {
  const status = usePaymentStatus(paymentId, initial);
  useEffect(() => {
    if (status === "PAID") window.location.assign(`/pagamento/sucesso?id=${paymentId}`);
    if (["FAILED", "CANCELLED", "EXPIRED"].includes(status)) window.location.assign(`/pagamento/erro?id=${paymentId}`);
  }, [status, paymentId]);
  return (
    <p className="flex items-center justify-center gap-2 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin text-primary" /> Aguardando confirmação do gateway…
    </p>
  );
}

export function SuccessStatus({ paymentId, initial }: { paymentId: string; initial: string }) {
  const status = usePaymentStatus(paymentId, initial, 3000);
  if (status === "PAID") {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
        <h1 className="mt-5 font-display text-4xl">Pagamento confirmado</h1>
        <p className="mt-2 text-sm text-muted">Sua assinatura está ativa e o conteúdo exclusivo já foi liberado.</p>
        <Button href="/conteudos" variant="glow" size="lg" className="mt-7">
          Acessar conteúdos
        </Button>
      </div>
    );
  }
  if (["FAILED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(status)) {
    return (
      <div className="text-center">
        <XCircle className="mx-auto h-14 w-14 text-danger" />
        <h1 className="mt-5 font-display text-4xl">Pagamento não confirmado</h1>
        <p className="mt-2 text-sm text-muted">O gateway não aprovou este pagamento.</p>
        <Button href="/planos" variant="outline" size="lg" className="mt-7">
          Tentar novamente
        </Button>
      </div>
    );
  }
  return (
    <div className="text-center">
      <Loader2 className="mx-auto h-14 w-14 animate-spin text-primary" />
      <h1 className="mt-5 font-display text-4xl">Confirmando pagamento</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        Estamos aguardando a confirmação do gateway. Isso costuma levar poucos segundos — o acesso é liberado automaticamente.
      </p>
    </div>
  );
}

export function DemoControls({ paymentId, redirectOnDone = true }: { paymentId: string; redirectOnDone?: boolean }) {
  const [loading, setLoading] = useState<"PAID" | "FAILED" | null>(null);
  const toast = useToast();
  async function simulate(outcome: "PAID" | "FAILED") {
    setLoading(outcome);
    try {
      await api("/api/payment/demo", { method: "POST", body: { paymentId, outcome } });
      toast.success(outcome === "PAID" ? "Webhook de aprovação enviado" : "Webhook de recusa enviado");
      if (redirectOnDone) window.location.assign(outcome === "PAID" ? `/pagamento/sucesso?id=${paymentId}` : `/pagamento/erro?id=${paymentId}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(null);
    }
  }
  return (
    <div className="rounded-card border border-dashed border-secondary/40 bg-secondary/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Modo Demo</p>
      <p className="mt-1 text-xs text-muted">Simule a resposta do gateway. Um webhook assinado será processado pelo mesmo fluxo de produção.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => simulate("PAID")} loading={loading === "PAID"}>
          Simular aprovação
        </Button>
        <Button size="sm" variant="danger" onClick={() => simulate("FAILED")} loading={loading === "FAILED"}>
          Simular recusa
        </Button>
      </div>
    </div>
  );
}
