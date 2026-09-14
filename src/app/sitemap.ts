import type { MetadataRoute } from "next";
import { env } from "@/server/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${env.appUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${env.appUrl}/planos`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${env.appUrl}/termos`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${env.appUrl}/privacidade`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
