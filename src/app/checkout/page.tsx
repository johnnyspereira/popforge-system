import { Suspense } from "react";
import { StorefrontCheckout } from "@/components/commerce/storefront-checkout";
export const dynamic = "force-dynamic";
export default function CheckoutPage() { return <Suspense fallback={<main className="min-h-screen bg-[#071014] p-10 text-slate-100">A carregar checkout…</main>}><StorefrontCheckout /></Suspense>; }
