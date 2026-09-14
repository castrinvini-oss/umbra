import { PrismaClient } from "@prisma/client";

// Uma instância por processo. Em serverless (Vercel), cada instância reaproveita
// a conexão entre invocações; o pooler do Supabase (porta 6543) segura a carga.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalForPrisma.prisma = db;
