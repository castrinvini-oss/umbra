// Templates transacionais. HTML com estilos inline (compatível com clientes de e-mail).

export type EmailTemplateName =
  | "welcome"
  | "confirmSignup"
  | "paymentApproved"
  | "paymentPending"
  | "paymentFailed"
  | "subscriptionCancelled"
  | "renewal"
  | "passwordReset";

type Vars = {
  siteName: string;
  appUrl: string;
  name: string;
  planName?: string;
  amount?: string;
  expiresAt?: string;
  link?: string;
  reason?: string;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(v: Vars, title: string, paragraphs: string[], cta?: { label: string; href: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6;color:#cfc9d6">${p}</p>`).join("");
  const button = cta
    ? `<a href="${esc(cta.href)}" style="display:inline-block;margin-top:8px;padding:12px 22px;border-radius:999px;background:#E7B77A;color:#1a1206;font-weight:700;text-decoration:none">${esc(cta.label)}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#0A090D;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141218;border:1px solid #2a2630;border-radius:18px;padding:32px">
<tr><td>
<div style="font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#E7B77A;margin-bottom:18px">${esc(v.siteName)}</div>
<h1 style="margin:0 0 16px;font-size:22px;color:#F2EEE7">${title}</h1>
${body}${button}
<p style="margin:28px 0 0;font-size:12px;color:#7d7786;line-height:1.5">Conteúdo destinado exclusivamente a maiores de 18 anos.<br/>Você recebeu este e-mail porque possui uma conta em ${esc(v.siteName)}.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function renderEmail(name: EmailTemplateName, v: Vars): { subject: string; html: string; text: string } {
  const n = esc(v.name.split(" ")[0] ?? v.name);
  const plan = esc(v.planName ?? "");
  const dash = `${v.appUrl}/dashboard`;
  let subject: string;
  let html: string;

  switch (name) {
    case "welcome":
      subject = `Bem-vindo(a) ao ${v.siteName}`;
      html = layout(v, `Olá, ${n}!`, ["Sua conta foi criada. Escolha um plano para liberar o conteúdo exclusivo."], {
        label: "Ver planos",
        href: `${v.appUrl}/planos`,
      });
      break;
    case "confirmSignup":
      subject = "Confirme seu cadastro";
      html = layout(v, "Confirme seu e-mail", ["Clique no botão abaixo para confirmar seu endereço de e-mail."], {
        label: "Confirmar e-mail",
        href: v.link ?? v.appUrl,
      });
      break;
    case "paymentApproved":
      subject = "Pagamento aprovado — acesso liberado";
      html = layout(
        v,
        "Pagamento confirmado",
        [`Recebemos o pagamento de <b>${esc(v.amount ?? "")}</b> referente ao plano <b>${plan}</b>.`, `Seu acesso é válido até <b>${esc(v.expiresAt ?? "")}</b>.`],
        { label: "Acessar conteúdos", href: dash },
      );
      break;
    case "paymentPending":
      subject = "Aguardando seu pagamento";
      html = layout(v, "Pagamento pendente", [`Seu pedido do plano <b>${plan}</b> (${esc(v.amount ?? "")}) foi criado e aguarda confirmação.`], {
        label: "Concluir pagamento",
        href: v.link ?? dash,
      });
      break;
    case "paymentFailed":
      subject = "Não foi possível processar seu pagamento";
      html = layout(
        v,
        "Pagamento recusado",
        [`O pagamento do plano <b>${plan}</b> não foi aprovado.${v.reason ? ` Motivo: ${esc(v.reason)}.` : ""}`, "Você pode tentar novamente com outro método."],
        { label: "Tentar novamente", href: `${v.appUrl}/planos` },
      );
      break;
    case "subscriptionCancelled":
      subject = "Assinatura cancelada";
      html = layout(
        v,
        "Sua assinatura foi cancelada",
        [`A assinatura do plano <b>${plan}</b> foi cancelada.`, v.expiresAt ? `Você mantém o acesso até <b>${esc(v.expiresAt)}</b>.` : "O acesso ao conteúdo exclusivo foi encerrado."],
        { label: "Reativar assinatura", href: `${v.appUrl}/planos` },
      );
      break;
    case "renewal":
      subject = "Assinatura renovada";
      html = layout(v, "Renovação confirmada", [`Sua assinatura do plano <b>${plan}</b> foi renovada até <b>${esc(v.expiresAt ?? "")}</b>.`], {
        label: "Ver novidades",
        href: dash,
      });
      break;
    case "passwordReset":
      subject = "Redefinição de senha";
      html = layout(v, "Redefinir senha", ["Recebemos uma solicitação para redefinir sua senha. O link expira em 1 hora.", "Se não foi você, ignore este e-mail."], {
        label: "Criar nova senha",
        href: v.link ?? v.appUrl,
      });
      break;
  }

  const text = html
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/p>/g, "\n\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g, "$2: $1")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { subject, html, text };
}

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateName, string> = {
  welcome: "Boas-vindas",
  confirmSignup: "Confirmação de cadastro",
  paymentApproved: "Pagamento aprovado",
  paymentPending: "Pagamento pendente",
  paymentFailed: "Pagamento recusado",
  subscriptionCancelled: "Assinatura cancelada",
  renewal: "Renovação",
  passwordReset: "Recuperação de senha",
};
