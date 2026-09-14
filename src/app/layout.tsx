import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { cssVarsToString, themeToCssVars } from "@/lib/site-config";
import { env } from "@/server/env";
import { resolvePublicUrls } from "@/server/services/media.service";
import { getSiteConfig } from "@/server/services/settings.service";
import "./globals.css";

export const dynamic = "force-dynamic";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-display", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteConfig();
  const urls = await resolvePublicUrls([site.seo.ogImageMediaId, site.identity.faviconMediaId]);
  const og = site.seo.ogImageMediaId ? urls.get(site.seo.ogImageMediaId) : undefined;
  const favicon = site.identity.faviconMediaId ? urls.get(site.identity.faviconMediaId) : undefined;
  return {
    metadataBase: new URL(env.appUrl),
    title: { default: site.seo.title, template: `%s · ${site.identity.siteName}` },
    description: site.seo.description,
    keywords: site.seo.keywords || undefined,
    applicationName: site.identity.siteName,
    icons: favicon ? { icon: favicon } : { icon: "/icon.svg" },
    openGraph: {
      type: "website",
      siteName: site.identity.siteName,
      title: site.seo.title,
      description: site.seo.description,
      url: env.appUrl,
      images: og ? [{ url: og, width: 1200, height: 630 }] : undefined,
      locale: "pt_BR",
    },
    twitter: {
      card: og ? "summary_large_image" : "summary",
      title: site.seo.title,
      description: site.seo.description,
      site: site.seo.twitterHandle || undefined,
      images: og ? [og] : undefined,
    },
    other: { rating: "adult", RATING: "RTA-5042-1996-1400-1577-RTA" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0A090D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteConfig();
  const vars = cssVarsToString(themeToCssVars(site.theme));
  return (
    <html lang="pt-BR" data-card={site.theme.cardStyle} className={`${sans.variable} ${display.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root{${vars}}` }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
