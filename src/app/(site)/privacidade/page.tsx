import { getSiteConfig } from "@/server/services/settings.service";

export const metadata = { title: "Política de privacidade" };

export default async function PrivacyPage() {
  const site = await getSiteConfig();
  return (
    <article className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 font-display text-5xl">Privacidade</h1>
      <p className="mt-3 text-sm text-muted">Modelo de referência alinhado à LGPD — revise com assessoria jurídica antes de publicar.</p>
      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-ink/80 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink">
        <section>
          <h2>Dados coletados</h2>
          <p>
            Nome, e-mail, data de nascimento (para verificação de maioridade), telefone opcional, CPF quando exigido pelo meio de pagamento (armazenado
            criptografado), histórico de pagamentos e registros técnicos de acesso (IP e navegador) para segurança.
          </p>
        </section>
        <section>
          <h2>Dados que NÃO armazenamos</h2>
          <p>Número completo de cartão, CVV ou senha bancária. Pagamentos são processados diretamente pelo gateway.</p>
        </section>
        <section>
          <h2>Finalidade</h2>
          <p>Prestar o serviço de assinatura, confirmar pagamentos, prevenir fraudes, cumprir obrigações legais e enviar comunicações transacionais.</p>
        </section>
        <section>
          <h2>Discrição</h2>
          <p>{site.identity.siteName} não compartilha sua assinatura com terceiros além dos processadores necessários à operação.</p>
        </section>
        <section>
          <h2>Seus direitos</h2>
          <p>Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail de suporte.</p>
        </section>
      </div>
    </article>
  );
}
