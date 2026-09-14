/**
 * Dispara o job de assinaturas na aplicação em execução.
 *   npm run cron:subscriptions
 *
 * Em produção agende a cada hora (crontab, GitHub Actions, Vercel Cron…):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/subscriptions
 */
try {
  process.loadEnvFile(".env");
} catch {
  /* variáveis já definidas no ambiente */
}

const url = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/cron/subscriptions`;
const secret = process.env.CRON_SECRET ?? "";

fetch(url, { method: "POST", headers: { authorization: `Bearer ${secret}` } })
  .then(async (res) => {
    const body = await res.text();
    console.log(res.status, body);
    if (!res.ok) process.exit(1);
  })
  .catch((e) => {
    console.error("✖ Falha ao chamar", url, e.message);
    process.exit(1);
  });
