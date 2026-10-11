import type { Metadata } from "next";
import { headers } from "next/headers";
import { PublicStorefront } from "@/components/commerce/public-storefront";
import { loadStorefrontCatalog, resolveStorefrontAccount } from "@/lib/commerce/storefront";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "POPForge — Custom 3D Creations", description: "Peças únicas, decoração e impressão 3D personalizada, produzidas em Portugal.", robots: { index: true, follow: true } };

export default async function StorefrontPage() {
  const host = (await headers()).get("host") || undefined;
  const accountId = await resolveStorefrontAccount(host);
  const catalog = accountId ? await loadStorefrontCatalog(accountId).catch(() => ({ products: [], categories: [] })) : { products: [], categories: [] };
  return <PublicStorefront catalog={catalog} />;
}
