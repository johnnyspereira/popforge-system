import { headers } from "next/headers";
import { PublicStorefront } from "@/components/commerce/public-storefront";
import { loadStorefrontCatalog, resolveStorefrontAccount } from "@/lib/commerce/storefront";
export const dynamic = "force-dynamic";
export default async function ProductsPage() { const accountId = await resolveStorefrontAccount((await headers()).get("host") || undefined); const catalog = accountId ? await loadStorefrontCatalog(accountId).catch(() => ({ products: [], categories: [] })) : { products: [], categories: [] }; return <PublicStorefront catalog={catalog} />; }
