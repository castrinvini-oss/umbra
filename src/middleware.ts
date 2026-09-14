import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/constants";

// Rotas acessíveis sem confirmação de maioridade (não exibem conteúdo adulto).
const AGE_EXEMPT = [/^\/18$/, /^\/admin(\/|$)/, /^\/login$/, /^\/recuperar-senha$/, /^\/redefinir-senha$/, /^\/termos$/, /^\/privacidade$/];

// Nunca indexar áreas privadas/transacionais.
const NOINDEX = /^\/(admin|dashboard|conteudos|meu-plano|perfil|configuracoes|checkout|pagamento|login|cadastro|recuperar-senha|redefinir-senha|18)(\/|$)/;

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const ageOk = req.cookies.get(COOKIE.age)?.value === "1";

  let res: NextResponse;
  if (!ageOk && !AGE_EXEMPT.some((r) => r.test(pathname))) {
    const url = req.nextUrl.clone();
    url.pathname = "/18";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    res = NextResponse.redirect(url);
  } else {
    res = NextResponse.next();
  }

  // Captura origem do lead (utm_source / ref) para o CRM.
  const source = req.nextUrl.searchParams.get("utm_source") ?? req.nextUrl.searchParams.get("ref");
  if (source && !req.cookies.get(COOKIE.lead)) {
    res.cookies.set(COOKIE.lead, source.slice(0, 60), { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  }

  // Token CSRF (double submit) — lido pelo cliente e enviado no header x-csrf-token.
  if (!req.cookies.get(COOKIE.csrf)) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);
    res.cookies.set(COOKIE.csrf, token, { path: "/", sameSite: "strict", secure: process.env.NODE_ENV === "production" });
  }

  if (NOINDEX.test(pathname)) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  // Exclui API, assets e arquivos estáticos (uploads grandes não passam pelo middleware).
  matcher: ["/((?!api|_next/static|_next/image|icon.svg|robots.txt|sitemap.xml|favicon.ico).*)"],
};
