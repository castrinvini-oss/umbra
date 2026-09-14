# Umbra

Plataforma própria de assinatura de conteúdo para **maiores de 18 anos**: página pública do creator, planos, checkout com gateway configurável, área do assinante, CMS do site, CRM, moderação e relatórios.

Identidade visual, código e layout próprios. Next.js 15 (App Router) + Prisma + PostgreSQL + TypeScript.

> 🚀 **Publicar na Vercel com Supabase:** siga o [DEPLOY-VERCEL-SUPABASE.md](DEPLOY-VERCEL-SUPABASE.md).

> ⚠️ **Uso responsável.** A plataforma exige confirmação de maioridade (tela +18, data de nascimento validada no cadastro), exige declaração de maioridade e consentimento de todas as pessoas retratadas para publicar e oferece denúncia, moderação, bloqueio e remoção de conteúdo. Confirme com o gateway de pagamento e a assessoria jurídica que sua operação está de acordo com os termos deles e a legislação local antes de colocar em produção.

---

## Sumário

1. [Início rápido (modo demo)](#início-rápido-modo-demo)
2. [Estrutura do projeto](#estrutura-do-projeto)
3. [Variáveis de ambiente](#variáveis-de-ambiente)
4. [Banco de dados](#banco-de-dados)
5. [Criar o primeiro administrador](#criar-o-primeiro-administrador)
6. [Configurar o gateway de pagamento](#configurar-o-gateway-de-pagamento)
7. [Configurar o armazenamento de mídia](#configurar-o-armazenamento-de-mídia)
8. [E-mails](#e-mails)
9. [Job de assinaturas (cron)](#job-de-assinaturas-cron)
10. [Segurança](#segurança)
11. [Rotas e API](#rotas-e-api)
12. [Deploy em produção](#deploy-em-produção)

---

## Início rápido (modo demo)

Requisitos: **Node.js 20.12+** (testado no 24), npm e um **PostgreSQL**. O mais simples é criar um projeto gratuito no Supabase só para desenvolvimento; também funciona com Postgres local.

```bash
npm install
```

```bash
cp .env.example .env
```

No `.env`, preencha `DATABASE_URL` e `DIRECT_URL` (veja a seção 1.1 do [guia de deploy](DEPLOY-VERCEL-SUPABASE.md#11-strings-de-conexão)). Para desenvolver sem Supabase Storage, use `STORAGE_DRIVER="local"`.

Gere os segredos e cole em `SESSION_SECRET` e `ENCRYPTION_KEY` no `.env`:

```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(48).toString('base64url')); console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
```

Crie o banco e carregue os dados de demonstração:

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Abra http://localhost:3000.

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@umbra.local` (ou `ADMIN_EMAIL`) | `Admin@12345678` (ou `ADMIN_PASSWORD`) |
| Moderador | `moderador@umbra.local` | `Demo@12345678` |
| Assinante (Premium ativo) | `assinante@umbra.local` | `Demo@12345678` |

**Modo Demo** (`DEMO_MODE=true`) usa o gateway *mock*: o checkout gera um PIX fictício ou uma página de pagamento simulada, e os botões "Simular aprovação/recusa" enviam um **webhook assinado** que passa pelo mesmo pipeline de produção (validação de assinatura → idempotência → ativação). Nenhuma cobrança real acontece. O seed apaga os dados existentes — nunca rode em produção.

> Se instalou com npm 11+ e o Prisma/sharp não funcionarem, aprove os scripts de instalação: `npm install-scripts approve @prisma/client prisma @prisma/engines sharp esbuild` e depois `npm rebuild`.

---

## Estrutura do projeto

```
prisma/
  schema.prisma          Modelo de dados (users, profiles, plans, subscriptions, payments,
                         content, content_categories, media, leads, lead_events, reports,
                         notifications, admin_logs, settings, webhook_events, sessions…)
  migrations/            Migrations SQL
  seed.ts                Dados de demonstração (imagens abstratas geradas localmente)
scripts/
  create-admin.ts        Cria/promove administrador (seguro em produção)
  run-subscription-job.ts
src/
  middleware.ts          Age gate +18, token CSRF, noindex em áreas privadas
  app/
    (site)/              Página do creator, /planos, /checkout, /pagamento/*, termos
    (auth)/              /login (com 2FA), /cadastro, recuperação de senha
    (member)/            /dashboard, /conteudos, /meu-plano, /perfil, /configuracoes
    admin/               Painel completo
    18/                  Tela de confirmação de maioridade
    api/                 API REST (ver abaixo)
  components/            UI reutilizável (ui/, feed/, site/, admin/, member/…)
  lib/                   Código isomórfico: constantes, validação (zod), permissões, tema
  server/
    auth/                Sessões e guards
    http/                Envelope das rotas (auth, CSRF, rate limit, erros), streaming de mídia
    security/            Criptografia, senhas, rate limit, TOTP, detecção de tipo de arquivo
    payments/            PaymentGateway + adaptadores (mock, asaas, mercadopago)
    storage/             StorageProvider + adaptadores (local, s3)
    email/               Provedor + templates
    services/            Regras de negócio (acesso, conteúdo, assinaturas, pagamentos, CRM…)
```

As regras de negócio vivem em `src/server/services`; componentes visuais só recebem dados e chamam a API.

---

## Variáveis de ambiente

Todas documentadas em [`.env.example`](.env.example). As principais:

| Variável | Para quê |
|---|---|
| `APP_URL` | URL pública — links de e-mail, sitemap, retorno do gateway |
| `DEMO_MODE` | `true` habilita o gateway mock e as simulações. **`false` em produção** |
| `DATABASE_URL` | SQLite (`file:./dev.db`) ou PostgreSQL |
| `SESSION_SECRET` | Assina sessões, CSRF, URLs de mídia e desafios 2FA (≥ 32 caracteres) |
| `ENCRYPTION_KEY` | AES-256-GCM para credenciais do gateway, CPF e segredos 2FA (32 bytes base64) |
| `CRON_SECRET` | Autoriza o job de assinaturas via HTTP |
| `STORAGE_DRIVER` | `local` ou `s3` |
| `EMAIL_DRIVER` | `console` ou `smtp` |
| `ADMIN_*` | Primeiro administrador |

Em produção, a aplicação **se recusa a iniciar** sem `SESSION_SECRET` e `ENCRYPTION_KEY`. Não troque `ENCRYPTION_KEY` depois de salvar credenciais: os valores criptografados deixam de ser legíveis.

---

## Banco de dados

PostgreSQL (Supabase recomendado).

- `DATABASE_URL` — conexão usada pela aplicação. No Supabase use o **pooler de transação** (porta 6543) com `?pgbouncer=true&connection_limit=1`.
- `DIRECT_URL` — conexão direta ou pooler de sessão (porta 5432), usada só pelas migrations.
- Migrations em `prisma/migrations`:
  - `init` cria as tabelas.
  - `enable_rls` ativa Row Level Security sem políticas, bloqueando o acesso às tabelas pela Data API pública do Supabase.
- Aplicar: `npx prisma migrate deploy` (na Vercel isso roda automaticamente no `vercel-build`).
- Alterou o schema? `npm run db:migrate -- --name descricao` gera uma nova migration.

Campos de "enum" e JSON são `String`; os valores válidos ficam em `src/lib/constants.ts` e são validados com zod.

---

## Criar o primeiro administrador

Não use o seed em produção. Use o script, que não apaga nada:

```bash
npm run admin:create -- --email voce@seudominio.com --name "Seu Nome" --password "UmaSenhaForte123"
```

Sem argumentos, ele lê `ADMIN_EMAIL`, `ADMIN_NAME` e `ADMIN_PASSWORD` do `.env`. Se o e-mail já existir, a conta é promovida a ADMIN. Depois:

1. Entre em `/login` → você cai em `/admin/dashboard`.
2. Ative o **2FA** em *Configurações → Segurança*.
3. Configure o gateway em *Configurações → Pagamentos*.
4. Edite perfil, banner, planos e cores em *Perfil público*, *Banners*, *Planos* e *Personalizar site*.
5. Crie moderadores/creators em *Configurações → Equipe*.

Papéis: **ADMIN** (tudo) · **MODERATOR** (denúncias, leitura de assinantes) · **CREATOR** (conteúdo e site) · **SUBSCRIBER** (área do assinante). A matriz fica em `src/lib/permissions.ts` e é verificada no servidor em cada rota.

---

## Configurar o gateway de pagamento

Nada é fixo no código. Em **Painel → Configurações → Pagamentos**:

1. Escolha o gateway (Demonstração, MisticPay, Asaas ou Mercado Pago).
2. Preencha **API KEY**, **SECRET KEY** e **WEBHOOK SECRET** (salvos criptografados; campos vazios mantêm o valor atual).
3. Escolha **Sandbox** ou **Produção** e os métodos habilitados (PIX, cartão, boleto).
4. Clique em **Testar conexão** e depois em **Salvar**.
5. Cadastre a URL exibida (`{APP_URL}/api/payment/webhook`) no painel do gateway.

As variáveis `PAYMENT_*` do `.env` servem apenas de fallback enquanto nada foi salvo no painel.

### MisticPay (PIX)
- Na MisticPay: **API → Chaves de Acesso → Criar Chave de Acesso**, com escopo de cash-in. Copie o `sk_` na hora, porque ele aparece uma única vez.
- **API KEY:** Client ID (`pk_…`) · **SECRET KEY:** Client Secret (`sk_…`).
- **WEBHOOK SECRET:** um token aleatório criado por você. Ele vai na URL do webhook, que é enviada automaticamente em cada cobrança (não precisa cadastrar nada na MisticPay).
- O webhook da MisticPay **não é assinado**, então o status é sempre confirmado em `POST /transactions/check` com as suas credenciais antes de liberar acesso. Se um webhook se perder, a tela de pagamento reconcilia sozinha consultando a API.
- **Exige CPF** no checkout. Só PIX, sem recorrência automática: o assinante renova com um novo PIX em *Meu plano*. **Sem reembolso via API:** faça a devolução pelo painel da MisticPay. Aberturas de MED geram notificação para a equipe.

### Asaas
- **API KEY:** chave de API (`$aact_…`).
- **WEBHOOK SECRET:** o *token de autenticação* definido ao criar o webhook no Asaas (enviado no header `asaas-access-token`).
- Eventos: cobranças. PIX gera QR Code; cartão usa a fatura hospedada do Asaas com assinatura recorrente.

### Mercado Pago
- **API KEY:** Access Token (`TEST-…` no sandbox, `APP_USR-…` em produção).
- **WEBHOOK SECRET:** assinatura secreta em *Suas integrações → Webhooks* (valida o header `x-signature`).
- Eventos: *Pagamentos* e *Planos e assinaturas*. PIX via `/v1/payments`; cartão via `/preapproval` (hospedado e recorrente).

> Os adaptadores seguem a documentação pública dos gateways, mas **valide no sandbox** com a sua conta antes de ir para produção.

### Como o pagamento vira acesso

```
Checkout → cria Subscription(PENDING) + Payment(PENDING) → gateway.createCharge()
        → cliente paga no gateway
        → POST /api/payment/webhook
            1. valida assinatura/token (inválido = 401)
            2. registra o evento (idempotência por gateway + eventId)
            3. Payment → PAID · Subscription → ACTIVE · vencimento = +período
            4. lead → Cliente/Renovação · notificações · e-mail
```

A página `/pagamento/sucesso` **nunca** libera acesso: ela só lê o status do banco. Status suportados: `PENDING`, `PAID`, `FAILED`, `CANCELLED`, `REFUNDED`, `EXPIRED`. Reembolso e sincronização manual ficam em *Painel → Pagamentos*.

Dados de cartão **nunca** passam pelo servidor: o cartão é digitado no checkout hospedado do gateway.

### Adicionar outro gateway

1. Crie `src/server/payments/<nome>.ts` implementando `PaymentGateway` (`src/server/payments/types.ts`): `createCharge`, `getPaymentStatus`, `cancelSubscription`, `refund`, `parseWebhook`, `testConnection`.
2. Adicione o nome em `GATEWAYS` (`src/lib/constants.ts`).
3. Registre em `src/server/payments/index.ts`.

Nenhuma outra parte do sistema muda.

---

## Configurar o armazenamento de mídia

### Supabase Storage (recomendado na Vercel)

```env
STORAGE_DRIVER="supabase"
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."        # somente servidor
SUPABASE_PRIVATE_BUCKET="umbra-private"
SUPABASE_PUBLIC_BUCKET="umbra-public"
```

Crie os buckets com `npm run storage:setup`.

- **Bucket privado:** mídia premium, entregue só por URL assinada de curta duração.
- **Bucket público:** avatar, banner, logo, capas e prévias desfocadas, servidos direto pela CDN do Supabase.
- **Upload direto:** o navegador envia o arquivo ao Supabase por URL assinada de um único caminho, contornando o limite de 4,5 MB da Vercel. Em seguida o servidor valida o arquivo (veja abaixo).

### Local (somente desenvolvimento)
`STORAGE_DRIVER=local` grava em `STORAGE_LOCAL_DIR` (padrão `./storage`), **fora** da pasta pública. Não funciona na Vercel (disco efêmero).

### S3 compatível (recomendado em produção)
Funciona com AWS S3, Cloudflare R2, Backblaze B2, Wasabi e MinIO.

```env
STORAGE_DRIVER="s3"
S3_ENDPOINT="https://<account>.r2.cloudflarestorage.com"   # vazio para AWS
S3_REGION="auto"
S3_BUCKET="umbra-media"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_FORCE_PATH_STYLE="false"                                 # true para MinIO
S3_PUBLIC_CDN_URL="https://cdn.seudominio.com"              # opcional, só mídia pública
```

- O bucket deve ser **privado**. Mídia premium é entregue por URL pré-assinada de curta duração, gerada só depois da verificação de acesso.
- `S3_PUBLIC_CDN_URL` serve apenas arquivos em `public/` (avatar, banner, logo, capas). Aponte a CDN só para esse prefixo.
- Arquivos antigos continuam no provedor em que foram gravados (cada mídia guarda o seu), então dá para migrar aos poucos.

### Como o conteúdo premium é protegido
1. Upload em streaming com limite de tamanho (`MAX_IMAGE_MB`, `MAX_VIDEO_MB`).
2. Tipo real detectado pelos bytes do arquivo — extensão e Content-Type do navegador são ignorados.
3. Imagens são reprocessadas: remove EXIF/GPS e neutraliza arquivos poliglotas.
4. Para imagens privadas é gerado um derivado de 40 px desfocado — é só isso que usuários sem acesso recebem.
5. O feed de quem não tem acesso não contém URL do arquivo nem o texto completo.
6. `GET /api/media/:id` exige URL assinada, emitida para aquele usuário, e revalida `canAccessContent()` (sessão, assinatura válida, plano compatível, conteúdo ativo).

---

## E-mails

`EMAIL_DRIVER=console` registra os e-mails no terminal e em *Configurações → E-mails*. Para envio real:

```env
EMAIL_DRIVER="smtp"
EMAIL_FROM="Seu Site <nao-responda@seudominio.com>"
SMTP_HOST="smtp.seuprovedor.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."
```

Templates prontos em `src/server/email/templates.ts`: boas-vindas, confirmação de cadastro, pagamento aprovado, pendente e recusado, assinatura cancelada, renovação e recuperação de senha.

---

## Job de assinaturas (cron)

Expira períodos vencidos, finaliza cancelamentos agendados e expira cobranças pendentes antigas. Ele também roda sozinho (no máximo a cada 10 min) quando alguém acessa o painel ou a área do assinante, mas agende de hora em hora em produção:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://seudominio.com/api/cron/subscriptions
```

Ou localmente: `npm run cron:subscriptions`. Mesmo sem o job, o acesso respeita a data de vencimento em cada verificação.

---

## Segurança

- Senhas com bcrypt (custo 12) e comparação com tempo constante para e-mails inexistentes.
- Sessões em cookie httpOnly/SameSite; token armazenado só como hash SHA-256.
- CSRF: double submit cookie + verificação de `Origin` em toda requisição mutável.
- Rate limiting em login, 2FA, cadastro, checkout, denúncias, uploads e webhooks. Em produção os contadores ficam no Postgres (`RATE_LIMIT_STORE=database`), compartilhados entre as funções serverless.
- 2FA (TOTP) opcional para qualquer conta, recomendado para a equipe.
- Credenciais do gateway, CPF e segredos 2FA criptografados com AES-256-GCM.
- Log administrativo de todas as ações sensíveis (*Configurações → Logs*).
- Cabeçalhos de segurança (`nosniff`, `X-Frame-Options`, HSTS, `Referrer-Policy`).
- Áreas privadas com `noindex` (`X-Robots-Tag` e `robots.txt`); selo RTA para ferramentas de controle parental.
- Moderação: denúncias de possível envolvimento de menor ou ilegalidade aparecem destacadas como urgentes.

---

## Rotas e API

**Páginas públicas:** `/` · `/18` · `/login` · `/cadastro` · `/planos` · `/checkout` · `/pagamento/sucesso` · `/pagamento/pendente` · `/pagamento/erro` · `/termos` · `/privacidade`

**Assinante:** `/dashboard` · `/conteudos` · `/meu-plano` · `/perfil` · `/configuracoes`

**Painel:** `/admin/dashboard` · `/admin/leads` · `/admin/assinantes` · `/admin/conteudos` · `/admin/planos` · `/admin/perfil` · `/admin/banners` · `/admin/personalizar` · `/admin/pagamentos` · `/admin/relatorios` · `/admin/denuncias` · `/admin/configuracoes`

**API:**

| Método | Rota | Acesso |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` · `/api/auth/2fa` · `/api/auth/logout` | público |
| POST/PUT | `/api/auth/password` (solicitar / redefinir) | público |
| GET / PUT | `/api/profile` | público / site |
| GET / POST | `/api/plans` | público / planos |
| PUT / DELETE | `/api/plans/:id` | planos |
| GET / POST | `/api/content` | público (filtrado por permissão) / conteúdo |
| GET / PUT / DELETE | `/api/content/:id` | `canAccessContent` / conteúdo |
| POST | `/api/checkout` | público |
| POST | `/api/payment/webhook` | assinatura do gateway |
| GET | `/api/payment/status` | dono do pagamento |
| POST | `/api/subscription` (cancelar / renovar) | assinante |
| POST | `/api/reports` | público |
| GET | `/api/media/:id` · `/api/media/public/:id` · `/api/media/blur/:id` | URL assinada / público |
| POST | `/api/admin/media/upload` | conteúdo/site |
| GET | `/api/admin/leads` · `/api/admin/subscribers` · `/api/admin/payments` · `/api/admin/analytics` | por permissão |
| PATCH/POST | `/api/admin/leads/:id` · `/api/admin/subscribers/:id` · `/api/admin/payments/:id` · `/api/admin/reports/:id` | por permissão |
| GET/PUT/POST | `/api/admin/settings/payment` | configurações |
| PUT | `/api/admin/site` | site |
| GET | `/api/admin/export/{leads,assinantes,pagamentos}` | relatórios |
| POST | `/api/cron/subscriptions` | `CRON_SECRET` |

Erros seguem o formato `{ "error": "mensagem", "fields": { "campo": "mensagem" } }`.

---

## Deploy em produção

**Vercel + Supabase:** guia completo em [DEPLOY-VERCEL-SUPABASE.md](DEPLOY-VERCEL-SUPABASE.md).

Checklist geral (qualquer hospedagem):

- [ ] `DEMO_MODE="false"` e gateway real configurado e testado no sandbox
- [ ] `NODE_ENV=production`, `APP_URL` com HTTPS
- [ ] `SESSION_SECRET`, `ENCRYPTION_KEY` e `CRON_SECRET` aleatórios e guardados em cofre
- [ ] PostgreSQL + `npx prisma migrate deploy`
- [ ] `STORAGE_DRIVER="s3"` com bucket privado (ou volume persistente com backup)
- [ ] SMTP configurado
- [ ] Primeiro admin via `npm run admin:create` e 2FA ativado
- [ ] Webhook cadastrado no gateway
- [ ] Cron do job de assinaturas agendado
- [ ] Termos de uso e Política de privacidade revisados por assessoria jurídica
- [ ] Rate limit em Redis se houver mais de uma instância

```bash
npm run build
```

```bash
npm start
```

Uploads grandes precisam de um servidor Node de longa duração (VPS, Docker, Railway, Render, Fly.io). Em ambientes serverless com limite de corpo de requisição, prefira upload direto para o S3 com URL pré-assinada.
