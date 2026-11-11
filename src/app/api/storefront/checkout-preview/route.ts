import type { RowDataPacket } from "mysql2";
import { selectRows } from "@/lib/mysql/db";

type VariantRow = RowDataPacket & {
  id: string; product_name: string; variant_name: string; sku: string;
  price: string | number; stock_quantity: string | number; track_stock: boolean | number;
};
type CartItem = { variantId: string; quantity: number };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
  const items = (Array.isArray(body?.items) ? body.items : []).slice(0, 50).map((item) => {
    const value = item as Partial<CartItem>;
    return { variantId: typeof value.variantId === "string" ? value.variantId.slice(0, 36) : "", quantity: Math.max(1, Math.min(99, Math.floor(Number(value.quantity)) || 1)) };
  }).filter((item) => item.variantId);
  if (!items.length) return Response.json({ error: "O carrinho está vazio." }, { status: 400 });
  if (new Set(items.map((item) => item.variantId)).size !== items.length) return Response.json({ error: "O carrinho contém variantes repetidas." }, { status: 400 });

  const placeholders = items.map(() => "?").join(",");
  const variants = await selectRows<VariantRow[]>(`SELECT v.id,p.name AS product_name,v.name AS variant_name,v.sku,v.price,v.stock_quantity,v.track_stock FROM commerce_product_variants v JOIN commerce_products p ON p.id=v.product_id WHERE v.id IN (${placeholders}) AND v.active=TRUE AND p.status='active'`, items.map((item) => item.variantId));
  if (variants.length !== items.length) return Response.json({ error: "Um dos produtos já não está disponível." }, { status: 409 });

  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const lines = items.map((item) => {
    const variant = byId.get(item.variantId)!;
    const stock = Number(variant.stock_quantity);
    return { variantId: variant.id, name: variant.variant_name ? `${variant.product_name} · ${variant.variant_name}` : variant.product_name, sku: variant.sku, quantity: item.quantity, unitPrice: Number(variant.price), total: Number(variant.price) * item.quantity, available: !Boolean(variant.track_stock) || stock >= item.quantity, stock: Boolean(variant.track_stock) ? stock : null };
  });
  return Response.json({ lines, subtotal: lines.reduce((sum, line) => sum + line.total, 0), available: lines.every((line) => line.available) });
}
