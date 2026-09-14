import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/constants";
import { env } from "@/server/env";
import { randomToken } from "@/server/security/crypto";

export function GET(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  if (!req.cookies.get(COOKIE.csrf)) {
    res.cookies.set(COOKIE.csrf, randomToken(24), { path: "/", sameSite: "strict", secure: env.isProd });
  }
  return res;
}
