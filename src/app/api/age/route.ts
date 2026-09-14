import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/constants";
import { env } from "@/server/env";
import { verifyCsrf } from "@/server/http/api";

/** Registra a confirmação de maioridade do visitante (cookie de 1 ano). */
export async function POST(req: NextRequest) {
  if (!verifyCsrf(req)) return NextResponse.json({ error: "Recarregue a página" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { confirm?: boolean };
  if (body.confirm !== true) return NextResponse.json({ error: "Confirmação obrigatória" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE.age, "1", { path: "/", sameSite: "lax", secure: env.isProd, maxAge: 60 * 60 * 24 * 365 });
  return res;
}
