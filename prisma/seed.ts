/**
 * Seed de DEMONSTRAÇÃO — dados 100% fictícios.
 *   npm run db:seed
 *
 * Cria: administrador (ADMIN_EMAIL/ADMIN_PASSWORD), moderador e assinante demo,
 * perfil do creator, planos, categorias, publicações com imagens abstratas
 * geradas localmente, leads, assinaturas, pagamentos, denúncias e métricas.
 * ATENÇÃO: apaga os dados existentes. Não execute em produção.
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { storage } from "../src/server/storage";

try {
  process.loadEnvFile(".env");
} catch {
  /* variáveis já definidas no ambiente */
}

const db = new PrismaClient();

if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
  console.error("Seed bloqueado em produção. Defina ALLOW_SEED=true se tiver certeza.");
  process.exit(1);
}

// PRNG determinístico para dados reproduzíveis
let s = 20260913;
const rand = () => {
  s |= 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
const between = (a: number, b: number) => Math.floor(a + rand() * (b - a + 1));
const daysAgo = (d: number, h = between(8, 23)) => {
  const date = new Date(Date.now() - d * 86400_000);
  date.setHours(h, between(0, 59), 0, 0);
  return date;
};
const addMonths = (date: Date, m: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + m);
  return d;
};

// ── Imagens abstratas geradas (sem conteúdo real) ────────────────────────────

function abstractSvg(w: number, h: number, hue: number, variant: number) {
  const c1 = `hsl(${hue} 70% 55%)`;
  const c2 = `hsl(${(hue + 40) % 360} 65% 45%)`;
  const c3 = `hsl(${(hue + 320) % 360} 60% 30%)`;
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const cx = Math.round(w * (0.15 + ((i * 0.37 + variant * 0.13) % 0.8)));
    const cy = Math.round(h * (0.2 + ((i * 0.29 + variant * 0.21) % 0.7)));
    const r = Math.round(Math.min(w, h) * (0.18 + ((i + variant) % 4) * 0.07));
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${[c1, c2, c3][i % 3]}" opacity="${0.55 + (i % 3) * 0.12}"/>`;
  }).join("");
  const arcs = Array.from({ length: 3 }, (_, i) => {
    const r = Math.round(Math.min(w, h) * (0.25 + i * 0.12));
    return `<circle cx="${Math.round(w * 0.62)}" cy="${Math.round(h * 0.42)}" r="${r}" fill="none" stroke="hsl(${hue} 80% 85%)" stroke-opacity="0.12" stroke-width="${2 + i}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.round(Math.min(w, h) / 9)}"/></filter>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 30% 10%)"/><stop offset="1" stop-color="hsl(${(hue + 30) % 360} 35% 6%)"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/><g filter="url(#b)">${blobs}</g>${arcs}
  </svg>`;
}

async function makeMedia(opts: { w: number; h: number; hue: number; variant: number; visibility: "PUBLIC" | "PRIVATE"; name: string; uploaderId: string }) {
  const provider = storage();
  const id = crypto.randomBytes(12).toString("hex");
  const buf = await sharp(Buffer.from(abstractSvg(opts.w, opts.h, opts.hue, opts.variant))).jpeg({ quality: 82 }).toBuffer();
  const key = `${opts.visibility === "PUBLIC" ? "public" : "private"}/seed/${id}.jpg`;
  await provider.putBuffer(key, buf, "image/jpeg");
  let blurKey: string | null = null;
  if (opts.visibility === "PRIVATE") {
    blurKey = `blur/${id}.jpg`;
    await provider.putBuffer(blurKey, await sharp(buf).resize(40).blur(6).jpeg({ quality: 45 }).toBuffer(), "image/jpeg");
  }
  return db.media.create({
    data: {
      uploaderId: opts.uploaderId,
      kind: "IMAGE",
      visibility: opts.visibility,
      storageProvider: provider.name,
      storageKey: key,
      blurKey,
      originalName: opts.name,
      mimeType: "image/jpeg",
      sizeBytes: buf.length,
      width: opts.w,
      height: opts.h,
    },
  });
}

// ── Execução ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("↻ Limpando dados…");
  for (const model of [
    "leadEvent",
    "lead",
    "report",
    "notification",
    "adminLog",
    "emailLog",
    "webhookEvent",
    "payment",
    "subscription",
    "contentMedia",
    "content",
    "contentCategory",
    "media",
    "plan",
    "profile",
    "userActivity",
    "passwordResetToken",
    "session",
    "user",
    "setting",
  ] as const) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)[model].deleteMany();
  }

  const password = (p: string) => bcrypt.hash(p, 12);
  const now = new Date();

  console.log("👤 Usuários da equipe…");
  const admin = await db.user.create({
    data: {
      name: process.env.ADMIN_NAME || "Administrador",
      email: (process.env.ADMIN_EMAIL || "admin@umbra.local").toLowerCase(),
      passwordHash: await password(process.env.ADMIN_PASSWORD || "Admin@12345678"),
      role: "ADMIN",
      ageConfirmedAt: now,
      termsAcceptedAt: now,
      birthDate: new Date("1992-04-10"),
    },
  });
  await db.user.create({
    data: {
      name: "Moderação Demo",
      email: "moderador@umbra.local",
      passwordHash: await password("Demo@12345678"),
      role: "MODERATOR",
      ageConfirmedAt: now,
      termsAcceptedAt: now,
    },
  });

  console.log("🎨 Gerando imagens abstratas de demonstração…");
  const avatar = await makeMedia({ w: 600, h: 600, hue: 28, variant: 2, visibility: "PUBLIC", name: "avatar.jpg", uploaderId: admin.id });
  const banner = await makeMedia({ w: 1920, h: 640, hue: 330, variant: 5, visibility: "PUBLIC", name: "banner.jpg", uploaderId: admin.id });
  const og = await makeMedia({ w: 1200, h: 630, hue: 20, variant: 1, visibility: "PUBLIC", name: "og.jpg", uploaderId: admin.id });

  await db.profile.create({
    data: {
      userId: admin.id,
      displayName: "Luna Marés",
      username: "lunamares",
      headline: "Fotografia autoral, bastidores e diário criativo",
      bio: "Perfil fictício de demonstração. Aqui entram a apresentação do creator, o tipo de conteúdo publicado e a frequência de novidades.\nEdite tudo em Painel → Perfil público.",
      location: "São Paulo",
      verified: true,
      avatarMediaId: avatar.id,
      bannerMediaId: banner.id,
      socialLinks: JSON.stringify([
        { label: "Instagram", url: "https://example.com/instagram" },
        { label: "X", url: "https://example.com/x" },
      ]),
    },
  });

  await db.setting.createMany({
    data: [
      { key: "site.seo", value: JSON.stringify({ title: "Luna Marés · Umbra", description: "Assine e acesse ensaios exclusivos, bastidores e o diário criativo.", ogImageMediaId: og.id, twitterHandle: "", keywords: "fotografia, ensaios, conteúdo exclusivo" }) },
      { key: "site.identity", value: JSON.stringify({ siteName: "Umbra", tagline: "Clube privado de conteúdo exclusivo", logoMediaId: null, faviconMediaId: null }) },
    ],
  });

  console.log("🗂  Categorias e planos…");
  const cats = await Promise.all(
    ["Ensaios", "Bastidores", "Diário", "Especiais"].map((name, i) =>
      db.contentCategory.create({ data: { name, slug: name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), sortOrder: i } }),
    ),
  );
  const basic = await db.plan.create({
    data: {
      name: "Básico",
      slug: "basico",
      description: "Para conhecer o trabalho e acompanhar as novidades.",
      priceCents: 1990,
      intervalMonths: 1,
      level: 1,
      sortOrder: 0,
      benefits: JSON.stringify(["Publicações do plano Básico", "Diário criativo", "Novidades toda semana", "Cancele quando quiser"]),
    },
  });
  const premium = await db.plan.create({
    data: {
      name: "Premium",
      slug: "premium",
      description: "Acesso completo aos ensaios e bastidores.",
      priceCents: 3990,
      intervalMonths: 1,
      level: 2,
      featured: true,
      sortOrder: 1,
      benefits: JSON.stringify(["Tudo do Básico", "Ensaios completos em alta resolução", "Bastidores exclusivos", "Galerias organizadas por categoria"]),
    },
  });
  const vip = await db.plan.create({
    data: {
      name: "VIP",
      slug: "vip",
      description: "Tudo liberado, incluindo especiais — cobrança semestral.",
      priceCents: 19990,
      intervalMonths: 6,
      level: 3,
      sortOrder: 2,
      benefits: JSON.stringify(["Tudo do Premium", "Especiais exclusivos do VIP", "Acesso antecipado", "Melhor custo por mês"]),
    },
  });
  const plans = [basic, premium, vip];

  console.log("📝 Publicações…");
  const profile = await db.profile.findFirstOrThrow();
  const posts: { title: string; teaser: string; body: string; type: string; cat: number; plan: typeof basic | null; images: number; hue: number; days: number; pinned?: boolean; featured?: boolean; status?: string }[] = [
    { title: "Boas-vindas ao clube", teaser: "Um recado para quem chegou agora.", body: "Obrigada por estar aqui! Este é um post gratuito de demonstração — visível para todos os visitantes maiores de 18 anos.", type: "IMAGE", cat: 2, plan: null, images: 1, hue: 32, days: 40, pinned: true },
    { title: "Paleta de outono", teaser: "Estudo de cores para o próximo ensaio.", body: "Referências de luz e cor que vão guiar a próxima série.", type: "GALLERY", cat: 1, plan: null, images: 3, hue: 18, days: 33 },
    { title: "Série Maré Baixa", teaser: "Ensaio completo com 4 fotos.", body: "Série completa em alta resolução, disponível para assinantes Premium.", type: "GALLERY", cat: 0, plan: premium, images: 4, hue: 200, days: 2, featured: true },
    { title: "Diário #12", teaser: "Sobre rotina, luz natural e processo.", body: "Texto de diário exclusivo para assinantes. Aqui entra o relato completo, liberado a partir do plano Básico.", type: "TEXT", cat: 2, plan: basic, images: 0, hue: 0, days: 4 },
    { title: "Bastidores do estúdio", teaser: "Como a iluminação foi montada.", body: "Fotos de bastidores do último ensaio.", type: "GALLERY", cat: 1, plan: basic, images: 3, hue: 280, days: 6 },
    { title: "Retrato em contraluz", teaser: "Uma foto, muita luz.", body: "Foto única da série contraluz.", type: "IMAGE", cat: 0, plan: basic, images: 1, hue: 40, days: 9 },
    { title: "Série Neblina", teaser: "Ensaio completo com 5 fotos.", body: "Série completa, disponível para assinantes Premium.", type: "GALLERY", cat: 0, plan: premium, images: 5, hue: 220, days: 12 },
    { title: "Especial de aniversário", teaser: "Conteúdo especial do VIP.", body: "Especial exclusivo para membros VIP.", type: "GALLERY", cat: 3, plan: vip, images: 4, hue: 345, days: 15, featured: true },
    { title: "Diário #11", teaser: "Planejamento do mês.", body: "O que vem por aí nas próximas semanas.", type: "TEXT", cat: 2, plan: basic, images: 0, hue: 0, days: 18 },
    { title: "Cor e textura", teaser: "Detalhes da série anterior.", body: "Recortes em detalhe da série anterior.", type: "GALLERY", cat: 0, plan: premium, images: 3, hue: 150, days: 21 },
    { title: "Making of: locação externa", teaser: "Dia inteiro de produção.", body: "Registro do dia de produção externa.", type: "GALLERY", cat: 1, plan: premium, images: 2, hue: 95, days: 25 },
    { title: "Edição VIP: arquivo pessoal", teaser: "Seleção do arquivo pessoal.", body: "Seleção especial do arquivo, exclusiva VIP.", type: "GALLERY", cat: 3, plan: vip, images: 3, hue: 305, days: 28 },
    { title: "Série Ouro (agendada)", teaser: "Chega em breve.", body: "Publicação agendada de demonstração.", type: "GALLERY", cat: 0, plan: premium, images: 2, hue: 45, days: -3 },
    { title: "Rascunho: ideias soltas", teaser: "", body: "Rascunho de demonstração — não aparece no site.", type: "TEXT", cat: 2, plan: basic, images: 0, hue: 0, days: 1, status: "DRAFT" },
  ];

  const createdContent = [];
  for (const [i, p] of posts.entries()) {
    const mediaIds: string[] = [];
    for (let k = 0; k < p.images; k++) {
      const m = await makeMedia({ w: 1080, h: 1350, hue: (p.hue + k * 14) % 360, variant: i + k, visibility: "PRIVATE", name: `${p.title.toLowerCase().replace(/\W+/g, "-")}-${k + 1}.jpg`, uploaderId: admin.id });
      mediaIds.push(m.id);
    }
    const publishedAt = p.days >= 0 ? daysAgo(p.days) : new Date(Date.now() + Math.abs(p.days) * 86400_000);
    createdContent.push(
      await db.content.create({
        data: {
          profileId: profile.id,
          title: p.title,
          teaser: p.teaser,
          body: p.body,
          type: p.type,
          categoryId: cats[p.cat]!.id,
          requiredPlanId: p.plan?.id ?? null,
          status: p.status ?? "PUBLISHED",
          publishedAt: p.status === "DRAFT" ? null : publishedAt,
          pinned: p.pinned ?? false,
          featured: p.featured ?? false,
          tags: JSON.stringify(p.cat === 0 ? ["ensaio", "fotografia"] : p.cat === 1 ? ["bastidores"] : []),
          consentConfirmedAt: now,
          consentConfirmedBy: admin.id,
          media: { create: mediaIds.map((mediaId, sortOrder) => ({ mediaId, sortOrder })) },
        },
      }),
    );
  }

  console.log("💳 Leads, assinantes e pagamentos…");
  const firstNames = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabriela", "Heitor", "Isabela", "João", "Karina", "Lucas", "Marina", "Nicolas", "Olívia", "Pedro", "Rafaela", "Samuel", "Tatiana", "Vitor", "Yasmin", "Rodrigo", "Camila", "André", "Letícia", "Mateus", "Priscila", "Renato", "Sofia", "Thiago"];
  const lastInitials = "ABCDEFGHIJLMNOPRSTV".split("");
  const sources = ["instagram", "x", "direto", "direto", "google", "indicacao", "tiktok"];
  const demoHash = await password("Demo@12345678");

  // Assinante demo com Premium ativo
  const demoUser = await db.user.create({
    data: { name: "Assinante Demo", email: "assinante@umbra.local", passwordHash: demoHash, role: "SUBSCRIBER", ageConfirmedAt: now, termsAcceptedAt: now, birthDate: new Date("1995-08-20"), lastLoginAt: daysAgo(0) },
  });
  const demoStart = daysAgo(47);
  const demoSub = await db.subscription.create({
    data: { userId: demoUser.id, planId: premium.id, gateway: "mock", status: "ACTIVE", gatewayCustomerId: `mock_cus_${demoUser.id}`, currentPeriodStart: addMonths(demoStart, 1), currentPeriodEnd: addMonths(demoStart, 2) },
  });
  for (const [k, when] of [demoStart, addMonths(demoStart, 1)].entries()) {
    await db.payment.create({
      data: { userId: demoUser.id, planId: premium.id, subscriptionId: demoSub.id, amountCents: premium.priceCents, method: k === 0 ? "PIX" : "CARD", status: "PAID", kind: k === 0 ? "INITIAL" : "RENEWAL", gateway: "mock", gatewayPaymentId: `mock_pay_demo_${k}`, paidAt: when, createdAt: when },
    });
  }
  const demoLead = await db.lead.create({
    data: { userId: demoUser.id, name: demoUser.name, email: demoUser.email, source: "instagram", planId: premium.id, stage: "RENEWAL", potentialValueCents: premium.priceCents, lastActivity: "Renovação confirmada", lastActivityAt: addMonths(demoStart, 1), createdAt: daysAgo(49) },
  });
  await db.leadEvent.createMany({
    data: [
      { leadId: demoLead.id, type: "CREATED", description: "Lead criado (origem: instagram)", createdAt: daysAgo(49) },
      { leadId: demoLead.id, type: "STAGE_CHANGED", description: "Checkout iniciado: Premium via PIX → Checkout", createdAt: demoStart },
      { leadId: demoLead.id, type: "STAGE_CHANGED", description: "Pagamento aprovado (R$ 39,90) → Cliente", createdAt: demoStart },
      { leadId: demoLead.id, type: "STAGE_CHANGED", description: "Renovação confirmada (R$ 39,90) → Renovação", createdAt: addMonths(demoStart, 1) },
    ],
  });

  const usedEmails = new Set<string>();
  for (let i = 0; i < 90; i++) {
    const first = pick(firstNames);
    const name = `${first} ${pick(lastInitials)}.`;
    let email = `${first.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${i}@exemplo.com`;
    while (usedEmails.has(email)) email = `x${email}`;
    usedEmails.add(email);
    const created = daysAgo(between(0, 150));
    const ageDays = Math.floor((Date.now() - created.getTime()) / 86400_000);
    const roll = rand();
    // Distribuição do funil
    const outcome = roll < 0.18 ? "NEW" : roll < 0.3 ? "INTERESTED" : roll < 0.36 ? "CHECKOUT" : roll < 0.44 ? "PAYMENT_PENDING" : roll < 0.82 ? "CUSTOMER" : "CANCELLED";
    const plan = rand() < 0.3 ? basic : rand() < 0.8 ? premium : vip;
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: demoHash,
        role: "SUBSCRIBER",
        status: i % 37 === 5 ? "BLOCKED" : "ACTIVE",
        blockedReason: i % 37 === 5 ? "Compartilhamento de conta (demo)" : null,
        phone: rand() < 0.4 ? `(11) 9${between(1000, 9999)}-${between(1000, 9999)}` : null,
        ageConfirmedAt: created,
        termsAcceptedAt: created,
        birthDate: new Date(between(1970, 2003), between(0, 11), between(1, 28)),
        createdAt: created,
        lastLoginAt: daysAgo(between(0, Math.max(0, ageDays))),
      },
    });
    const lead = await db.lead.create({
      data: {
        userId: user.id,
        name,
        email,
        phone: user.phone,
        source: pick(sources),
        planId: outcome === "NEW" ? null : plan.id,
        stage: outcome,
        potentialValueCents: outcome === "NEW" ? 0 : plan.priceCents,
        createdAt: created,
        lastActivity: "Lead criado",
        lastActivityAt: created,
      },
    });
    const events: { type: string; description: string; createdAt: Date }[] = [{ type: "CREATED", description: `Lead criado (origem: ${lead.source})`, createdAt: created }];

    if (outcome === "CHECKOUT" || outcome === "PAYMENT_PENDING") {
      const when = new Date(created.getTime() + between(1, 48) * 3600_000);
      const sub = await db.subscription.create({ data: { userId: user.id, planId: plan.id, gateway: "mock", status: "PENDING", createdAt: when } });
      events.push({ type: "STAGE_CHANGED", description: `Checkout iniciado: ${plan.name} → Checkout`, createdAt: when });
      if (outcome === "PAYMENT_PENDING") {
        await db.payment.create({
          data: { userId: user.id, planId: plan.id, subscriptionId: sub.id, amountCents: plan.priceCents, method: "PIX", status: "PENDING", gateway: "mock", gatewayPaymentId: `mock_pay_${crypto.randomBytes(6).toString("hex")}`, pixCopyPaste: "00020126DEMO", expiresAt: new Date(Date.now() + 30 * 60_000), createdAt: new Date(Math.max(when.getTime(), Date.now() - 20 * 60_000)) },
        });
        events.push({ type: "STAGE_CHANGED", description: `Cobrança gerada → Pagamento pendente`, createdAt: when });
      }
      if (rand() < 0.4) {
        await db.payment.create({
          data: { userId: user.id, planId: plan.id, subscriptionId: sub.id, amountCents: plan.priceCents, method: "CARD", status: "FAILED", failureReason: "Recusado pelo emissor (simulação)", gateway: "mock", gatewayPaymentId: `mock_pay_${crypto.randomBytes(6).toString("hex")}`, createdAt: when },
        });
        events.push({ type: "PAYMENT_FAILED", description: "Pagamento recusado (Recusado pelo emissor)", createdAt: when });
      }
    }

    if (outcome === "CUSTOMER" || outcome === "CANCELLED") {
      const start = new Date(created.getTime() + between(1, 72) * 3600_000);
      if (start > new Date()) start.setTime(Date.now() - 3600_000);
      const sub = await db.subscription.create({ data: { userId: user.id, planId: plan.id, gateway: "mock", gatewayCustomerId: `mock_cus_${user.id}`, status: "ACTIVE", currentPeriodStart: start, currentPeriodEnd: addMonths(start, plan.intervalMonths), createdAt: start } });
      events.push({ type: "STAGE_CHANGED", description: `Pagamento aprovado → Cliente`, createdAt: start });
      let periodStart = start;
      let cycles = 0;
      // Pagamentos por ciclo até hoje
      while (periodStart <= new Date() && cycles < 8) {
        const method = cycles === 0 ? pick(["PIX", "PIX", "CARD", "BOLETO"]) : "CARD";
        await db.payment.create({
          data: { userId: user.id, planId: plan.id, subscriptionId: sub.id, amountCents: plan.priceCents, method, status: "PAID", kind: cycles === 0 ? "INITIAL" : "RENEWAL", gateway: "mock", gatewayPaymentId: `mock_pay_${crypto.randomBytes(6).toString("hex")}`, paidAt: periodStart, createdAt: periodStart },
        });
        if (cycles > 0) events.push({ type: "STAGE_CHANGED", description: `Renovação confirmada → Renovação`, createdAt: periodStart });
        const next = addMonths(periodStart, plan.intervalMonths);
        if (next > new Date()) break;
        periodStart = next;
        cycles++;
      }
      const periodEnd = addMonths(periodStart, plan.intervalMonths);
      if (outcome === "CANCELLED") {
        const cancelledAt = new Date(Math.min(Date.now(), periodStart.getTime() + between(2, 20) * 86400_000));
        const ended = rand() < 0.6;
        await db.subscription.update({
          where: { id: sub.id },
          data: ended
            ? { status: "CANCELLED", cancelledAt, currentPeriodStart: periodStart, currentPeriodEnd: cancelledAt, cancelReason: "Cancelada pelo assinante" }
            : { cancelAtPeriodEnd: true, cancelledAt, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, cancelReason: "Cancelada pelo assinante" },
        });
        events.push({ type: "STAGE_CHANGED", description: ended ? "Assinatura cancelada → Cancelado" : "Cancelamento agendado → Cancelado", createdAt: cancelledAt });
        if (ended && rand() < 0.25) {
          const last = await db.payment.findFirst({ where: { subscriptionId: sub.id, status: "PAID" }, orderBy: { paidAt: "desc" } });
          if (last) await db.payment.update({ where: { id: last.id }, data: { status: "REFUNDED", refundedAt: cancelledAt } });
        }
      } else {
        await db.subscription.update({ where: { id: sub.id }, data: { currentPeriodStart: periodStart, currentPeriodEnd: periodEnd } });
        if (cycles > 0) await db.lead.update({ where: { id: lead.id }, data: { stage: "RENEWAL" } });
      }
    }

    await db.leadEvent.createMany({ data: events.map((e) => ({ leadId: lead.id, ...e })) });
    const lastEvent = events[events.length - 1]!;
    await db.lead.update({ where: { id: lead.id }, data: { lastActivity: lastEvent.description, lastActivityAt: lastEvent.createdAt } });
    await db.userActivity.create({ data: { userId: user.id, type: "LOGIN", detail: "", ip: `177.${between(1, 254)}.${between(1, 254)}.${between(1, 254)}`, createdAt: user.lastLoginAt ?? created } });
  }

  console.log("🚩 Moderação, notificações e logs…");
  const reporter = await db.user.findFirstOrThrow({ where: { role: "SUBSCRIBER", email: { not: demoUser.email } } });
  await db.report.createMany({
    data: [
      { contentId: createdContent[5]!.id, reportedUserId: admin.id, reporterId: reporter.id, reason: "RULES", details: "Denúncia de demonstração: legenda com link externo.", status: "OPEN", createdAt: daysAgo(1) },
      { contentId: createdContent[9]!.id, reportedUserId: admin.id, reporterEmail: "visitante@exemplo.com", reason: "UNAUTHORIZED", details: "Denúncia de demonstração: alega uso de imagem sem autorização.", status: "REVIEWING", createdAt: daysAgo(3) },
      { contentId: createdContent[1]!.id, reportedUserId: admin.id, reporterId: reporter.id, reason: "OTHER", details: "Denúncia de demonstração já resolvida.", status: "DISMISSED", resolution: "Conteúdo dentro das regras.", resolvedById: admin.id, resolvedAt: daysAgo(8), createdAt: daysAgo(9) },
    ],
  });

  const recentPaid = await db.payment.findMany({ where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 6, include: { user: true, plan: true } });
  await db.notification.createMany({
    data: [
      ...recentPaid.map((p) => ({
        audience: "STAFF",
        type: p.kind === "RENEWAL" ? "RENEWAL" : "NEW_SUBSCRIPTION",
        title: p.kind === "RENEWAL" ? "Renovação confirmada" : "Nova assinatura",
        body: `${p.user.name} · ${p.plan.name}`,
        link: "/admin/assinantes",
        createdAt: p.paidAt!,
      })),
      { audience: "STAFF", type: "NEW_REPORT", title: "Nova denúncia", body: "Violação de regras", link: "/admin/denuncias", createdAt: daysAgo(1) },
      { audience: "STAFF", type: "NEW_SIGNUP", title: "Novo cadastro", body: "Lead vindo do Instagram", link: "/admin/leads", createdAt: daysAgo(0, 9) },
      { audience: "USER", userId: demoUser.id, type: "RENEWAL", title: "Assinatura renovada", body: "Plano Premium renovado.", link: "/meu-plano", createdAt: addMonths(demoStart, 1) },
    ],
  });

  await db.webhookEvent.createMany({
    data: recentPaid.map((p) => ({ gateway: "mock", eventId: `evt_seed_${p.id}`, type: "payment.paid", payload: "{}", status: "PROCESSED", processedAt: p.paidAt, createdAt: p.paidAt! })),
  });
  await db.adminLog.createMany({
    data: [
      { actorId: admin.id, action: "plan.create", entityType: "plan", entityId: premium.id, metadata: JSON.stringify({ name: "Premium" }), ip: "127.0.0.1", createdAt: daysAgo(60) },
      { actorId: admin.id, action: "profile.update", entityType: "profile", entityId: profile.id, ip: "127.0.0.1", createdAt: daysAgo(30) },
      { actorId: admin.id, action: "content.create", entityType: "content", entityId: createdContent[2]!.id, metadata: JSON.stringify({ title: "Série Maré Baixa" }), ip: "127.0.0.1", createdAt: daysAgo(2) },
    ],
  });

  const counts = await Promise.all([db.user.count(), db.lead.count(), db.payment.count({ where: { status: "PAID" } }), db.content.count()]);
  console.log(`\n✅ Seed concluído: ${counts[0]} usuários · ${counts[1]} leads · ${counts[2]} pagamentos aprovados · ${counts[3]} publicações`);
  console.log(`\n   Admin:     ${admin.email} / ${process.env.ADMIN_PASSWORD || "Admin@12345678"}`);
  console.log("   Moderador: moderador@umbra.local / Demo@12345678");
  console.log("   Assinante: assinante@umbra.local / Demo@12345678 (Premium ativo)\n");
  void plans;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
