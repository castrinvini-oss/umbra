import { db } from "../db";

/** Registro imutável de ações administrativas (quem, o quê, quando, de onde). */
export async function logAdmin(input: {
  actorId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  await db.adminLog
    .create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: JSON.stringify(input.metadata ?? {}),
        ip: input.ip,
      },
    })
    .catch((e) => console.error("[audit]", e));
}

export async function logActivity(userId: string, type: string, detail = "", ip?: string) {
  await db.userActivity.create({ data: { userId, type, detail, ip } }).catch(() => {});
}

export const ADMIN_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Login no painel",
  "plan.create": "Plano criado",
  "plan.update": "Plano atualizado",
  "plan.delete": "Plano removido",
  "content.create": "Publicação criada",
  "content.update": "Publicação editada",
  "content.delete": "Publicação excluída",
  "content.remove": "Conteúdo removido (moderação)",
  "media.upload": "Mídia enviada",
  "media.delete": "Mídia excluída",
  "profile.update": "Perfil público editado",
  "site.update": "Aparência do site editada",
  "payment.config": "Configuração de pagamento alterada",
  "payment.refund": "Reembolso solicitado",
  "payment.simulate": "Pagamento simulado (demo)",
  "subscriber.block": "Assinante bloqueado",
  "subscriber.unblock": "Assinante desbloqueado",
  "subscriber.cancel": "Assinatura cancelada",
  "subscriber.changePlan": "Plano alterado",
  "subscriber.grant": "Acesso concedido manualmente",
  "report.update": "Denúncia atualizada",
  "user.suspend": "Conta suspensa",
  "lead.update": "Lead atualizado",
  "team.create": "Membro da equipe criado",
  "security.2fa.enable": "2FA ativado",
  "security.2fa.disable": "2FA desativado",
  "category.create": "Categoria criada",
  "category.delete": "Categoria removida",
};
