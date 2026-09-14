# Deploy na Vercel com Supabase

Guia passo a passo para publicar a plataforma usando **Vercel** (aplicação) e **Supabase** (PostgreSQL + Storage).

```
Navegador ──► Vercel (Next.js, região gru1 / São Paulo)
                 │  Prisma ──► Supabase Postgres (pooler 6543)
                 │  API REST ─► Supabase Storage (bucket privado + público)
Navegador ──────────────────► Supabase Storage (upload direto por URL assinada)
Vercel Cron ─► /api/cron/subscriptions (diário)
```

Tempo estimado: 30–40 minutos.

---

## 1. Criar o projeto no Supabase

1. Acesse https://supabase.com/dashboard → **New project**.
2. **Region:** `South America (São Paulo)` — a mesma região das funções da Vercel (`gru1`, definida em `vercel.json`). Regiões distantes deixam cada consulta mais lenta.
3. Defina uma **senha forte para o banco** e guarde-a.

### 1.1 Strings de conexão

**Connect** (topo do painel) → **ORMs → Prisma**, ou *Project Settings → Database → Connection string*:

| Variável | Qual copiar | Porta | Sufixo obrigatório |
|---|---|---|---|
| `DATABASE_URL` | **Transaction pooler** | `6543` | `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | **Session pooler** | `5432` | — |

Exemplo (substitua referência, senha e host pelos seus):

```env
DATABASE_URL="postgresql://postgres.abcdefghijkl:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.abcdefghijkl:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

- `pgbouncer=true` é **obrigatório** no pooler de transação (desativa prepared statements nomeados).
- `connection_limit=1` evita que cada função serverless abra várias conexões.
- Se a senha tiver caracteres especiais (`@ # / ? &`), codifique-os na URL (ex.: `@` → `%40`).

### 1.2 Chaves da API

*Project Settings → API Keys*:

- `SUPABASE_URL` → `https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` → chave **service_role** (ou a nova **secret key** `sb_secret_…`)

> A chave de serviço dá acesso total ao projeto. Ela só é usada no servidor e **nunca** deve ir para o navegador ou para variáveis `NEXT_PUBLIC_*`.

### 1.3 Proteção da Data API

A segunda migration (`enable_rls`) ativa **Row Level Security sem políticas** em todas as tabelas. A aplicação continua funcionando, porque o Prisma conecta como `postgres`, que ignora RLS, mas ninguém consegue ler as tabelas pela API pública do Supabase com a chave `anon`.

Opcional e recomendado: como o app não usa a Data API, desative-a em *Project Settings → Data API*.

---

## 2. Preparar o banco e o storage (no seu computador)

Crie um `.env` local com os valores do Supabase (use o [`.env.example`](.env.example) como base) e gere os segredos:

```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(48).toString('base64url')); console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64')); console.log('CRON_SECRET=' + require('crypto').randomBytes(24).toString('base64url'))"
```

Guarde esses três valores: eles vão também para a Vercel, **idênticos**.

Instale as dependências:

```bash
npm install
```

Crie as tabelas no Supabase:

```bash
npx prisma migrate deploy
```

Crie os buckets de mídia (`umbra-private` privado e `umbra-public` público):

```bash
npm run storage:setup
```

Crie o primeiro administrador:

```bash
npm run admin:create -- --email voce@seudominio.com --name "Seu Nome" --password "UmaSenhaForte123"
```

Opcional, só para ver a plataforma com dados de demonstração. **Apaga todos os dados** e envia imagens de exemplo ao Storage:

```bash
npm run db:seed
```

### 2.1 Limite de tamanho no Storage

*Storage → Settings → Upload file size limit*. No plano **Free** o máximo por arquivo é **50 MB**, então mantenha `MAX_VIDEO_MB="50"`. No **Pro** aumente o limite do projeto e o `MAX_VIDEO_MB` juntos.

---

## 3. Subir o código para o GitHub

A Vercel publica a partir de um repositório Git. O `.gitignore` já exclui `.env`, `node_modules`, `.next` e `storage/`.

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Plataforma Umbra"
```

Crie um repositório **privado** no GitHub e envie:

```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
```

```bash
git push -u origin main
```

---

## 4. Criar o projeto na Vercel

1. https://vercel.com/new → importe o repositório.
2. **Framework Preset:** Next.js (detectado automaticamente).
3. **Build Command:** deixe o padrão. O `package.json` tem `vercel-build`, que roda `prisma generate && prisma migrate deploy && next build`, então novas migrations são aplicadas a cada deploy.
4. **Environment Variables:** cadastre as variáveis abaixo, para *Production* e, se quiser, *Preview*.

| Variável | Valor |
|---|---|
| `DATABASE_URL` | pooler de transação (6543) com `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | pooler de sessão (5432) |
| `SESSION_SECRET` | gerado no passo 2 |
| `ENCRYPTION_KEY` | gerado no passo 2 |
| `CRON_SECRET` | gerado no passo 2 |
| `STORAGE_DRIVER` | `supabase` |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | chave de serviço |
| `SUPABASE_PRIVATE_BUCKET` | `umbra-private` |
| `SUPABASE_PUBLIC_BUCKET` | `umbra-public` |
| `RATE_LIMIT_STORE` | `database` |
| `MAX_IMAGE_MB` | `20` |
| `MAX_VIDEO_MB` | `50` (Free) |
| `DEMO_MODE` | `true` para testar · `false` com clientes reais |
| `APP_URL` | vazio no primeiro deploy (usa o domínio `.vercel.app`); depois `https://seudominio.com` |
| `EMAIL_DRIVER` + `SMTP_*` | opcional (senão os e-mails ficam só no log) |

5. **Deploy.**

> Preview deployments usam o mesmo banco se receberem as mesmas variáveis. Para testar sem afetar produção, crie um segundo projeto no Supabase só para *Preview*.

---

## 5. Depois do primeiro deploy

1. Abra `https://<projeto>.vercel.app/login` e entre com o administrador.
2. **Configurações → Segurança:** ative o 2FA.
3. **Configurações → Pagamentos:** escolha o gateway, preencha as credenciais, **Testar conexão** e **Salvar**. Cadastre no gateway a URL exibida: `https://<seu-dominio>/api/payment/webhook`.
4. **Configurações → Sistema:** confira que o armazenamento aparece como *Supabase Storage*.
5. Envie uma imagem em **Conteúdos → Biblioteca de mídia** para validar o upload direto.
6. **Domínio próprio:** *Vercel → Settings → Domains*. Depois defina `APP_URL="https://seudominio.com"` e faça um novo deploy. Atualize também a URL do webhook no gateway.
7. Quando estiver pronto para vender: `DEMO_MODE="false"`, gateway real em modo *Produção* e novo deploy.

---

## 6. Cron (renovações e expirações)

O `vercel.json` agenda `GET /api/cron/subscriptions` **uma vez por dia** (06:00 UTC). A Vercel envia `Authorization: Bearer $CRON_SECRET` automaticamente quando a variável existe.

- **Hobby:** crons rodam no máximo 1×/dia, suficiente porque o acesso já respeita a data de vencimento em cada requisição.
- **Pro:** para rodar de hora em hora, troque o `schedule` para `"0 * * * *"`.

Para testar manualmente:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://SEU_DOMINIO/api/cron/subscriptions
```

---

## 7. Como a plataforma se adapta à Vercel

| Limitação da Vercel | Solução no código |
|---|---|
| Disco efêmero | `STORAGE_DRIVER=supabase`; o driver `local` é bloqueado com erro claro |
| Corpo de requisição limitado a **4,5 MB** | Upload **direto do navegador ao Supabase** por URL assinada de um único caminho; depois `/api/admin/media/complete` confere o tipo real pelos bytes e o tamanho, remove EXIF e gera a prévia desfocada. Arquivo inválido é apagado |
| Funções sem memória compartilhada | Rate limit gravado no Postgres (tabela `RateLimit`, upsert atômico) |
| Muitas conexões simultâneas | Pooler do Supabase + `connection_limit=1` + cliente Prisma reaproveitado |
| Sem processos contínuos | Vercel Cron no lugar do job interno |
| Mídia pública | Servida direto pela CDN do Supabase (bucket público) |
| Mídia premium | Bucket privado; URL assinada de 15 min emitida só após `canAccessContent()` |

---

## 8. Solução de problemas

**`prepared statement "s0" already exists`**
Falta `?pgbouncer=true` na `DATABASE_URL`.

**`Can't reach database server` durante o build**
A `DIRECT_URL` está errada ou ausente na Vercel. As migrations usam a `DIRECT_URL`.

**Build falha em `prisma migrate deploy` com erro de lock/timeout**
Confirme que a `DIRECT_URL` usa a porta **5432**, não a 6543.

**Upload falha com 413 / "exceeded the maximum allowed size"**
O limite do Storage do Supabase é menor que o arquivo. Ajuste *Storage → Settings* e o `MAX_VIDEO_MB`.

**Upload falha com erro de CORS**
Verifique se `SUPABASE_URL` é exatamente `https://<ref>.supabase.co`, sem barra final nem `/storage/v1`.

**Imagens não aparecem**
Rode `npm run storage:setup` para garantir que `umbra-public` existe e está marcado como **Public**.

**Erro 500 "SESSION_SECRET deve ter pelo menos 32 caracteres"**
Variáveis de segurança ausentes na Vercel, ou cadastradas só para *Preview*/*Production*.

**Login sempre "Muitas tentativas"**
Normal após várias tentativas erradas; a janela é de 5 minutos por IP.

---

## 9. Checklist final

- [ ] Supabase em São Paulo, senha forte, Data API desativada (ou RLS ativo pela migration)
- [ ] `DATABASE_URL` (6543, `pgbouncer=true`) e `DIRECT_URL` (5432) na Vercel
- [ ] `SESSION_SECRET`, `ENCRYPTION_KEY` e `CRON_SECRET` guardados em cofre
- [ ] Buckets criados (`npm run storage:setup`), `umbra-public` público
- [ ] Administrador criado e 2FA ativo
- [ ] Gateway configurado, testado em sandbox e webhook cadastrado
- [ ] Gateway confirmou que aceita a sua categoria de negócio
- [ ] Domínio próprio + `APP_URL` + webhook atualizados
- [ ] `DEMO_MODE="false"` em produção
- [ ] Termos de uso e Política de privacidade revisados por assessoria jurídica
- [ ] Backups: *Supabase → Database → Backups* (diários no plano Pro)
