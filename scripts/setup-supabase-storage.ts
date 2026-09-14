/**
 * Cria os buckets do Supabase Storage usados pela plataforma.
 *   npm run storage:setup
 *
 * - SUPABASE_PRIVATE_BUCKET (padrão umbra-private) → PRIVADO: mídia premium
 * - SUPABASE_PUBLIC_BUCKET  (padrão umbra-public)  → PÚBLICO: avatar, banner, logo, capas e prévias desfocadas
 *
 * Seguro para rodar mais de uma vez.
 */
import { SupabaseStorage } from "../src/server/storage/supabase";

try {
  process.loadEnvFile(".env");
} catch {
  /* variáveis já definidas no ambiente */
}

async function main() {
  const maxVideoMb = Number(process.env.MAX_VIDEO_MB ?? "1024") || 1024;
  const storage = new SupabaseStorage({
    url: (process.env.SUPABASE_URL ?? "").replace(/\/$/, ""),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    privateBucket: process.env.SUPABASE_PRIVATE_BUCKET || "umbra-private",
    publicBucket: process.env.SUPABASE_PUBLIC_BUCKET || "umbra-public",
  });
  const results = await storage.ensureBuckets();
  for (const r of results) console.log(`✅ ${r}`);
  console.log("\nConfira em Supabase → Storage. O limite global de tamanho de arquivo do projeto");
  console.log(`(Storage → Settings) precisa ser ≥ MAX_VIDEO_MB (${maxVideoMb} MB). No plano Free o máximo é 50 MB.`);
}

main().catch((e) => {
  console.error("✖", e.message);
  process.exit(1);
});
