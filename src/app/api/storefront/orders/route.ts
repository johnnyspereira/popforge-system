import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { transaction } from "@/lib/mysql/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { InsufficientStockError, reserveVariantStock } from "@/lib/commerce/stock";
import { clientIp, resolveStorefrontContact } from "@/lib/commerce/storefront-contact";
import { createProductionPlan } from "@/lib/commerce/production-plan";

type VariantRow = RowDataPacket & { id: string; account_id: string; product_id: string; sku: string; price: string | number; stock_quantity: string | number; track_stock: boolean | number; product_name: string };
type CartInput = { variantId: string; quantity: number; customization?: Record<string, unknown> };
const text = (value: unknown, length: number) => String(value ?? "").trim().slice(0, length);
const paymentMethods = new Set(["bank_transfer", "mbway", "multibanco", "payment_link"]);
const deliveryMethods = new Set(["ctt", "carrier", "collection"]);

export async function POST(request: Request) {
  const limit = checkRateLimit(`storefront-order:${clientIp(request)}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!limit.success) return rateLimitResponse(limit);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = text(body?.name, 180), email = text(body?.email, 320).toLowerCase();
  const phone = text(body?.phone, 40).replace(/[^+\d]/g, "");
  const paymentMethod = text(body?.paymentMethod, 64) || "payment_link";
  const deliveryMethod = text(body?.deliveryMethod, 120) || "ctt";
  const address = {
    line1: text(body?.addressLine1, 180), line2: text(body?.addressLine2, 180) || null,
    postalCode: text(body?.postalCode, 24), city: text(body?.city, 120), country: text(body?.country, 80) || "Portugal",
  };
  const rawItems = Array.isArray(body?.items) ? body.items : body?.variantId ? [{ variantId: body.variantId, quantity: body.quantity }] : [];
  const items = rawItems.slice(0, 50).map((raw) => {
    const item = raw as Record<string, unknown>;
    return { variantId: text(item.variantId, 36), quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity)) || 1)), customization: item.customization && typeof item.customization === "object" ? item.customization as Record<string, unknown> : {} } satisfies CartInput;
  }).filter((item) => item.variantId);
  if (!name || !email.includes("@") || phone.length < 7 || !items.length || !address.line1 || !address.postalCode || !address.city) return Response.json({ error: "Preencha os dados de contacto, entrega e adicione pelo menos um produto." }, { status: 400 });
  if (!paymentMethods.has(paymentMethod) || !deliveryMethods.has(deliveryMethod)) return Response.json({ error: "A opção de pagamento ou entrega é inválida." }, { status: 400 });
  if (new Set(items.map((item) => item.variantId)).size !== items.length) return Response.json({ error: "Cada variante deve aparecer apenas uma vez no carrinho." }, { status: 400 });
  try {
    const result = await transaction(async (connection) => {
      const placeholders = items.map(() => "?").join(",");
      // Prices come from the database, never from the browser. Locking in id
      // order keeps concurrent checkouts from deadlocking each other.
      const [variants] = await connection.execute<VariantRow[]>(`SELECT v.id,v.account_id,v.product_id,v.sku,v.price,v.stock_quantity,v.track_stock,p.name AS product_name FROM commerce_product_variants v JOIN commerce_products p ON p.id=v.product_id WHERE v.id IN (${placeholders}) AND v.active=TRUE AND p.status='active' ORDER BY v.id FOR UPDATE`, items.map((item) => item.variantId));
      if (variants.length !== items.length) throw new Error("PRODUCT_UNAVAILABLE");
      const accountId = variants[0].account_id;
      if (variants.some((variant) => variant.account_id !== accountId)) throw new Error("MIXED_STORE");
      const selected = new Map(variants.map((variant) => [variant.id, variant]));
      for (const item of items) if (Boolean(selected.get(item.variantId)!.track_stock) && Number(selected.get(item.variantId)!.stock_quantity) < item.quantity) throw new Error("INSUFFICIENT_STOCK");
      const [owners] = await connection.execute<(RowDataPacket & { owner_user_id: string })[]>("SELECT owner_user_id FROM accounts WHERE id=? LIMIT 1", [accountId]);
      if (!owners[0]?.owner_user_id) throw new Error("ACCOUNT_UNAVAILABLE");
      const contact = await resolveStorefrontContact(connection, { accountId, ownerUserId: owners[0].owner_user_id, name, email, phone, create: true });
      const contactId = contact?.contactId ?? null;
      const reviewRequired = Boolean(contact?.reviewRequired);
      const subtotal = items.reduce((sum, item) => sum + Number(selected.get(item.variantId)!.price) * item.quantity, 0);
      const orderId = randomUUID();
      const [order] = await connection.execute<ResultSetHeader>("INSERT INTO commerce_orders(id,account_id,contact_id,customer_review_required,status,payment_status,payment_method,channel,currency,subtotal,shipping_total,delivery_method,total,customer_email,customer_name,customer_phone,shipping_address,notes) VALUES(?,?,?,?,'pending_payment','pending',?,'online_store','EUR',?,?,?, ?,?,?,?, ?,?)", [orderId, accountId, contactId, reviewRequired, paymentMethod, subtotal, 0, deliveryMethod, subtotal, email, name, phone, JSON.stringify(address), text(body?.notes, 4000) || null]);
      let reserved = false;
      for (const item of items) {
        const variant = selected.get(item.variantId)!;
        const total = Number(variant.price) * item.quantity;
        await connection.execute("INSERT INTO commerce_order_items(id,account_id,order_id,product_id,variant_id,sku,product_name,quantity,unit_price,line_total,customization) VALUES(?,?,?,?,?,?,?,?,?,?,?)", [randomUUID(), accountId, orderId, variant.product_id, variant.id, variant.sku, variant.product_name, item.quantity, Number(variant.price), total, JSON.stringify(item.customization)]);
        if (Boolean(variant.track_stock)) {
          await reserveVariantStock(connection, { accountId, orderId, reference: `ORDER-${order.insertId}`, variantId: variant.id, quantity: item.quantity, notes: "Reserva criada pela loja online" });
          reserved = true;
        }
      }
      if (reserved) await connection.execute("UPDATE commerce_orders SET stock_state='reserved' WHERE id=?", [orderId]);
      await connection.execute("INSERT INTO commerce_order_history(id,account_id,order_id,event_type,new_value,notes,metadata) VALUES(?,?,?,?,?,?,?)", [randomUUID(), accountId, orderId, "order_created", "pending_payment", "Encomenda criada pela loja online", JSON.stringify({ payment_method: paymentMethod, delivery_method: deliveryMethod })]);
      if (contact?.reviewRequired) {
        await connection.execute("INSERT INTO commerce_order_history(id,account_id,order_id,event_type,notes,metadata) VALUES(?,?,?,?,?,?)", [randomUUID(), accountId, orderId, "customer_review_required", "O telefone corresponde a um cliente existente com outro e-mail. Confirme manualmente antes de associar.", JSON.stringify({ conflict_contact_id: contact.conflictContactId })]);
      }
      // The jobs are queued from the product's explicit production defaults.
      // They are not started until the order is confirmed by the operator.
      await createProductionPlan(connection, { accountId, orderId, actorUserId: owners[0].owner_user_id });
      return { orderNumber: order.insertId, orderId };
    });
    return Response.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    const code = error instanceof InsufficientStockError ? "INSUFFICIENT_STOCK" : error instanceof Error ? error.message : "";
    const messages: Record<string, string> = { PRODUCT_UNAVAILABLE: "Um dos produtos já não está disponível.", INSUFFICIENT_STOCK: "A quantidade pedida já não está disponível.", MIXED_STORE: "O carrinho contém produtos de lojas diferentes.", ACCOUNT_UNAVAILABLE: "A loja não está disponível." };
    if (messages[code]) return Response.json({ error: messages[code] }, { status: code === "INSUFFICIENT_STOCK" ? 409 : 400 });
    console.error("[storefront-order]", error);
    return Response.json({ error: "Não foi possível registar a encomenda. Tente novamente." }, { status: 500 });
  }
}
