import { NextResponse } from "next/server";
import { LEAD_STAGE_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type LeadStage, type PaymentMethod, type PaymentStatus } from "@/lib/constants";
import { apiRoute, notFound } from "@/server/http/api";
import { listLeads, listPayments, listSubscribers } from "@/server/services/admin-queries.service";

function csv(rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // prefixo evita injeção de fórmula ao abrir no Excel
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\n");
}

const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export const GET = apiRoute({ auth: "reports.view" }, async ({ params }) => {
  let content: string;
  switch (params.type) {
    case "pagamentos": {
      const rows = await listPayments({});
      content = csv([
        ["ID", "Cliente", "E-mail", "Plano", "Valor (R$)", "Método", "Status", "Tipo", "Gateway", "Criado em", "Pago em"],
        ...rows.map((p) => [p.id, p.userName, p.userEmail, p.planName, reais(p.amountCents), PAYMENT_METHOD_LABELS[p.method as PaymentMethod], PAYMENT_STATUS_LABELS[p.status as PaymentStatus], p.kind, p.gateway, p.createdAt, p.paidAt]),
      ]);
      break;
    }
    case "assinantes": {
      const rows = await listSubscribers({});
      content = csv([
        ["Nome", "E-mail", "Plano", "Status", "Valor (R$)", "Próxima cobrança", "Cadastro"],
        ...rows.map((s) => [s.name, s.email, s.subscription?.planName, s.subscription?.status ?? "SEM ASSINATURA", s.subscription ? reais(s.subscription.priceCents) : "", s.subscription?.currentPeriodEnd, s.createdAt]),
      ]);
      break;
    }
    case "leads": {
      const rows = await listLeads({});
      content = csv([
        ["Nome", "E-mail", "Telefone", "Origem", "Plano", "Etapa", "Valor potencial (R$)", "Última atividade", "Cadastro"],
        ...rows.map((l) => [l.name, l.email, l.phone, l.source, l.planName, LEAD_STAGE_LABELS[l.stage as LeadStage], reais(l.potentialValueCents), l.lastActivityAt, l.createdAt]),
      ]);
      break;
    }
    default:
      throw notFound();
  }
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${params.type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
