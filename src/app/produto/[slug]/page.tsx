import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/commerce/product-detail";
import { loadStorefrontProduct, resolveStorefrontAccount } from "@/lib/commerce/storefront";

export const dynamic = "force-dynamic";
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const accountId = await resolveStorefrontAccount((await headers()).get("host") || undefined);
  const product = accountId ? await loadStorefrontProduct(accountId, slug).catch(() => null) : null;
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
