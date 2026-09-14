import { getSiteConfig } from "@/server/services/settings.service";

export const metadata = { title: "Termos de uso" };

export default async function TermsPage() {
  const site = await getSiteConfig();
  const name = site.identity.siteName;
  return (
    <article className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 font-display text-5xl">Termos de uso</h1>
      <p className="mt-3 text-sm text-muted">
        Modelo de referência — revise com assessoria jurídica antes de publicar. Última atualização: {new Date().toLocaleDateString("pt-BR")}.
      </p>
      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-ink/80 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink">
        <section>
          <h2>1. Público exclusivamente adulto</h2>
          <p>
            {name} é destinado exclusivamente a pessoas com 18 anos ou mais. Ao acessar, criar conta ou assinar, você declara ser maior de idade e que o
            acesso a conteúdo adulto é permitido na sua jurisdição. Contas de menores serão encerradas imediatamente.
          </p>
        </section>
        <section>
          <h2>2. Tolerância zero com envolvimento de menores</h2>
          <p>
            É terminantemente proibido publicar, solicitar ou compartilhar qualquer material que envolva menores de 18 anos. Todo conteúdo publicado exige
            declaração expressa de que todas as pessoas retratadas são maiores de idade e consentiram com a produção e a publicação. Violações resultam em
            remoção imediata, encerramento da conta e comunicação às autoridades competentes.
          </p>
        </section>
        <section>
          <h2>3. Assinaturas e pagamentos</h2>
          <p>
            O acesso ao conteúdo exclusivo é liberado após a confirmação do pagamento pelo processador. Assinaturas podem ser canceladas a qualquer
            momento; o acesso permanece até o fim do período já pago. Não armazenamos dados completos de cartão.
          </p>
        </section>
        <section>
          <h2>4. Uso do conteúdo</h2>
          <p>
            O conteúdo é licenciado para visualização pessoal. É proibido copiar, gravar, redistribuir ou revender qualquer material. Contas envolvidas em
            vazamento serão bloqueadas sem reembolso.
          </p>
        </section>
        <section id="denuncias" className="scroll-mt-24">
          <h2>5. Denúncias e remoção</h2>
          <p>
            Qualquer pessoa pode denunciar conteúdo pelo botão “Denunciar” presente em cada publicação — inclusive conteúdo publicado sem autorização de
            quem aparece nele. Denúncias são analisadas pela moderação com prioridade para casos de possível ilegalidade ou envolvimento de menores.
          </p>
        </section>
        <section>
          <h2>6. Conduta</h2>
          <p>É proibido assédio, tentativa de burlar controles de acesso, compartilhamento de credenciais e qualquer atividade ilegal.</p>
        </section>
      </div>
    </article>
  );
}
