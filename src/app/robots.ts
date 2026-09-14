import type { MetadataRoute } from "next";
import { env } from "@/server/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/planos", "/termos", "/privacidade"],
        disallow: ["/admin", "/api", "/dashboard", "/conteudos", "/meu-plano", "/perfil", "/configuracoes", "/checkout", "/pagamento", "/login", "/cadastro", "/18"],
      },
    ],
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
