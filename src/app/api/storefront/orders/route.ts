import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { transaction } from "@/lib/mysql/db";

type VariantRow = RowDataPacket & { id: string; account_id: string; product_id: string; sku: string; price: string | number; stock_quantity: string | number; track_stock: boolean | number; product_name: string };
type CartInput = { variantId: string; quantity: number; customization?: Record<string, unknown> };
const text = (value: unknown, length: number) => String(value ?? "").trim().slice(0, length);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = text(body?.name, 180), email = text(body?.email, 320).toLowerCase();
  const phone = text(body?.phone, 40).replace(/[^+\d]/g, "");
  const rawItems = Array.isArray(body?.items) ? body.items : body?.variantId ? [{ variantId: body.variantId, quantity: body.quantity }] : [];
  const items = rawItems.map((raw) => {
    const item = raw as Record<string, unknown>;
    return { variantId: text(item.variantId, 36), quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)), customization: item.customization && typeof item.customization === "object" ? item.customization as Record<string, unknown> : {} } satisfies CartInput;
  }).filter((item) => item.variantId);
  if (!name || !email.includes("@") || phone.length < 7 || !items.length) return Response.json({ error: "Preencha os dados de contacto e adicione pelo menos um produto." }, { status: 400 });
  if (new Set(items.map((item) => item.variantId)).size !== items.length) return Response.json({ error: "Cada variante deve aparecer apenas uma vez no carrinho." }, { status: 400 });
  try {
    const result = await transaction(async (connection) => {
      const placeholders = items.map(() => "?").join(",");
      const [variants] = await connection.execute<VariantRow[]>(`SELECT v.id,v.account_id,v.product_id,v.sku,v.price,v.stock_quantity,v.track_stock,p.name AS product_name FROM commerce_product_variants v JOIN commerce_products p ON p.id=v.product_id WHERE v.id IN (${placeholders}) AND v.active=TRUE AND p.status='active' FOR UPDATE`, items.map((item) => item.variantId));
      if (variants.length !== items.length) throw new Error("PRODUCT_UNAVAILABLE");
      const accountId = variants[0].account_id;
      if (variants.some((variant) => variant.account_id !== accountId)) throw new Error("MIXED_STORE");
      const selected = new Map(variants.map((variant) => [variant.id, variant]));
      for (const item of items) if (Boolean(selected.get(item.variantId)!.track_stock) && Number(selected.get(item.variantId)!.stock_quantity) < item.quantity) throw new Error("INSUFFICIENT_STOCK");
      const [owners] = await connection.execute<(RowDataPacket & { owner_user_id: string })[]>("SELECT owner_user_id FROM accounts WHERE id=? LIMIT 1", [accountId]);
      if (!owners[0]?.owner_user_id) throw new Error("ACCOUNT_UNAVAILABLE");
      const [contacts] = await connection.execute<(RowDataPacket & { id: string })[]>("SELECT id FROM contacts WHERE account_id=? AND (email=? OR phone=?) LIMIT 1", [accountId, email, phone]);
      const contactId = contacts[0]?.id || randomUUID();
      if (contacts[0]) await connection.execute("UPDATE contacts SET name=?,email=?,phone=?,source='Loja online' WHERE id=?", [name, email, phone, contactId]);
      else await connection.execute("INSERT INTO contacts(id,account_id,user_id,phone,name,email,source,preferred_contact,marketing_consent,whatsapp_consent) VALUES(?,?,?,?,?,?,'Loja online','email',FALSE,FALSE)", [contactId, accountId, owners[0].owner_user_id, phone, name, email]);
      const subtotal = items.reduce((sum, item) => sum + Number(selected.get(item.variantId)!.price) * item.quantity, 0);
      const orderId = randomUUID();
      const [order] = await connection.execute<ResultSetHeader>("INSERT INTO commerce_orders(id,account_id,contact_id,status,payment_status,channel,currency,subtotal,total,customer_email,customer_name,customer_phone,notes) VALUES(?,?,?,'pending_payment','pending','online_store','EUR',?,?,?,?,?,?)", [orderId, accountId, contactId, subtotal, subtotal, email, name, phone, text(body?.notes, 4000) || null]);
      for (const item of items) {
        const variant = selected.get(item.variantId)!;
        const total = Number(variant.price) * item.quantity;
        await connection.execute("INSERT INTO commerce_order_items(id,account_id,order_id,product_id,variant_id,sku,product_name,quantity,unit_price,line_total,customization) VALUES(?,?,?,?,?,?,?,?,?,?,?)", [randomUUID(), accountId, orderId, variant.product_id, variant.id, variant.sku, variant.product_name, item.quantity, Number(variant.price), total, JSON.stringify(item.customization)]);
        if (Boolean(variant.track_stock)) {
          await connection.execute("UPDATE commerce_product_variants SET stock_quantity=stock_quantity-? WHERE id=?", [item.quantity, variant.id]);
          await connection.execute("INSERT INTO commerce_stock_movements(id,account_id,variant_id,order_id,movement_type,quantity,reference,notes) VALUES(?,?,?,?, 'reservation',?,?,?)", [randomUUID(), accountId, variant.id, orderId, -item.quantity, `ORDER-${order.insertId}`, "Reserva criada pela loja online"]);
        }
      }
      await connection.execute("INSERT INTO commerce_order_history(id,account_id,order_id,event_type,new_value,notes) VALUES(?,?,?,?,?,?)", [randomUUID(), accountId, orderId, "order_created", "pending_payment", "Encomenda criada pela loja online"]);
      return { orderNumber: order.insertId, orderId };
    });
    return Response.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = { PRODUCT_UNAVAILABLE: "Um dos produtos já não está disponível.", INSUFFICIENT_STOCK: "A quantidade pedida já não está disponível.", MIXED_STORE: "O carrinho contém produtos de lojas diferentes.", ACCOUNT_UNAVAILABLE: "A loja não está disponível." };
    if (messages[code]) return Response.json({ error: messages[code] }, { status: code === "INSUFFICIENT_STOCK" ? 409 : 400 });
    console.error("[storefront-order]", error);
    return Response.json({ error: "Não foi possível registar a encomenda. Tente novamente." }, { status: 500 });
  }
}
