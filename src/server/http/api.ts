import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { COOKIE } from "@/lib/constants";
import { can, type Permission } from "@/lib/permissions";
import { getCurrentUser, type SessionUser } from "../auth/session";
import { safeEqual } from "../security/crypto";
import { rateLimit, type RateRule } from "../security/rate-limit";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, fields?: Record<string, string>) => new HttpError(400, msg, fields);
export const notFound = (msg = "Não encontrado") => new HttpError(404, msg);
export const forbidden = (msg = "Sem permissão para esta ação") => new HttpError(403, msg);

type Auth = "public" | "user" | Permission;

type Options<S extends ZodTypeAny | undefined> = {
  auth?: Auth;
  schema?: S;
  /** Chave e regra de rate limit (por IP). */
  rate?: [string, RateRule];
  /** Verificação CSRF em métodos mutáveis (padrão: true). Webhooks desativam. */
  csrf?: boolean;
};

type Ctx<S extends ZodTypeAny | undefined, A extends Auth> = {
  req: NextRequest;
  user: A extends "public" ? SessionUser | null : SessionUser;
  body: S extends ZodTypeAny ? z.infer<S> : undefined;
  params: Record<string, string>;
  ip: string;
};

export function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function verifyCsrf(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  const cookie = req.cookies.get(COOKIE.csrf)?.value ?? "";
  const header = req.headers.get("x-csrf-token") ?? "";
  return cookie.length >= 16 && safeEqual(cookie, header);
}

/**
 * Envelope padrão das rotas de API: autenticação, permissão, CSRF, rate limit,
 * validação (zod) e tratamento de erros consistente ({ error, fields }).
 */
export function apiRoute<S extends ZodTypeAny | undefined = undefined, A extends Auth = "user">(
  opts: Options<S> & { auth?: A },
  fn: (ctx: Ctx<S, A>) => Promise<unknown>,
) {
  return async (req: NextRequest, context: { params: Promise<any> }) => {
    try {
      const ip = getIp(req);
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);

      if (opts.rate) {
        const r = await rateLimit(`${opts.rate[0]}:${ip}`, opts.rate[1]);
        if (!r.ok)
          return NextResponse.json(
            { error: `Muitas tentativas. Tente novamente em ${r.retryAfter}s.` },
            { status: 429, headers: { "Retry-After": String(r.retryAfter) } },
          );
      }

      if (mutating && opts.csrf !== false && !verifyCsrf(req)) {
        return NextResponse.json({ error: "Sessão expirada. Recarregue a página." }, { status: 403 });
      }

      const auth = opts.auth ?? "user";
      const user = await getCurrentUser();
      if (auth !== "public") {
        if (!user) return NextResponse.json({ error: "Faça login para continuar" }, { status: 401 });
        if (auth !== "user" && !can(user.role, auth)) throw forbidden();
      }

      let body: unknown = undefined;
      if (opts.schema) {
        const raw = mutating ? await req.json().catch(() => ({})) : Object.fromEntries(req.nextUrl.searchParams);
        body = opts.schema.parse(raw);
      }

      const params = (await context?.params) ?? {};
      const result = await fn({ req, user, body, params, ip } as Ctx<S, A>);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    const first = err.issues[0]?.message ?? "Dados inválidos";
    return NextResponse.json({ error: first, fields }, { status: 422 });
  }
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message, fields: err.fields }, { status: err.status });
  }
  console.error("[api]", err);
  return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
}
