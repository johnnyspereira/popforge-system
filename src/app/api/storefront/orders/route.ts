import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { selectRows, transaction } from "@/lib/mysql/db";

interface VariantRow extends RowDataPacket {
  id: string;
  account_id: string;
  product_id: string;
  sku: string;
  price: string | number;
  stock_quantity: string | number;
  track_stock: number | boolean;
  product_name: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const variantId = String(body?.variantId || "");
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "")
    .trim()
    .toLowerCase();
  const phone = String(body?.phone || "")
    .replace(/[^+\d]/g, "")
    .trim();
  const quantity = Math.max(1, Math.min(25, Number(body?.quantity) || 1));
  if (!variantId || !name || !email.includes("@") || phone.length < 7)
    return Response.json(
      { error: "Preencha nome, e-mail, telefone e quantidade." },
      { status: 400 },
    );

  const variants = await selectRows<VariantRow[]>(
    `SELECT v.id, v.account_id, v.product_id, v.sku, v.price, v.stock_quantity, v.track_stock, p.name AS product_name
       FROM commerce_product_variants v
       JOIN commerce_products p ON p.id = v.product_id
      WHERE v.id = ? AND v.active = TRUE AND p.status = 'active' LIMIT 1`,
    [variantId],
  );
  const variant = variants[0];
  if (!variant)
    return Response.json({ error: "Produto indisponível." }, { status: 404 });
  if (Boolean(variant.track_stock) && Number(variant.stock_quantity) < quantity)
    return Response.json(
      { error: "A quantidade pedida já não está disponível." },
      { status: 409 },
    );

  const total = Number(variant.price) * quantity;
  const orderId = randomUUID();
  const itemId = randomUUID();
  try {
    const orderNumber = await transaction(async (connection) => {
      const [lockedVariants] = await connection.execute<VariantRow[]>(
        `SELECT v.id,v.account_id,v.product_id,v.sku,v.price,v.stock_quantity,v.track_stock,p.name AS product_name
         FROM commerce_product_variants v JOIN commerce_products p ON p.id=v.product_id
        WHERE v.id=? AND v.active=TRUE AND p.status='active' LIMIT 1 FOR UPDATE`,
        [variantId],
      );
      const lockedVariant = lockedVariants[0];
      if (!lockedVariant) throw new Error("PRODUCT_UNAVAILABLE");
      if (
        Boolean(lockedVariant.track_stock) &&
        Number(lockedVariant.stock_quantity) < quantity
      )
        throw new Error("INSUFFICIENT_STOCK");
      const [accountRows] = await connection.execute<
        (RowDataPacket & { owner_user_id: string })[]
      >("SELECT owner_user_id FROM accounts WHERE id = ? LIMIT 1", [
        variant.account_id,
      ]);
      const ownerUserId = accountRows[0]?.owner_user_id;
      if (!ownerUserId) throw new Error("Conta da loja indisponível.");
      const [contactRows] = await connection.execute<
        (RowDataPacket & { id: string })[]
      >("SELECT id FROM contacts WHERE account_id = ? AND phone = ? LIMIT 1", [
        variant.account_id,
        phone,
      ]);
      const contactId = contactRows[0]?.id || randomUUID();
      if (contactRows[0])
        await connection.execute(
          "UPDATE contacts SET name = ?, email = ?, source = ? WHERE id = ?",
          [name, email, "Loja online", contactId],
        );
      else
        await connection.execute(
          `INSERT INTO contacts (id, account_id, user_id, phone, name, email, source, preferred_contact, marketing_consent, whatsapp_consent) VALUES (?, ?, ?, ?, ?, ?, 'Loja online', 'whatsapp', FALSE, TRUE)`,
          [contactId, variant.account_id, ownerUserId, phone, name, email],
        );
      const [order] = await connection.execute<
        import("mysql2").ResultSetHeader
      >(
        `INSERT INTO commerce_orders (id, account_id, contact_id, status, channel, currency, subtotal, total, customer_email, customer_name)
       VALUES (?, ?, ?, 'pending_payment', 'online_store', 'EUR', ?, ?, ?, ?)`,
        [orderId, variant.account_id, contactId, total, total, email, name],
      );
      await connection.execute(
        `INSERT INTO commerce_order_items (id, account_id, order_id, product_id, variant_id, sku, product_name, quantity, unit_price, line_total, customization)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, JSON_OBJECT())`,
        [
          itemId,
          variant.account_id,
          orderId,
          variant.product_id,
          variant.id,
          variant.sku,
          variant.product_name,
          quantity,
          Number(variant.price),
          total,
        ],
      );
      if (Boolean(lockedVariant.track_stock)) {
        await connection.execute(
          "UPDATE commerce_product_variants SET stock_quantity=stock_quantity-? WHERE id=?",
          [quantity, lockedVariant.id],
        );
      }
      return order.insertId;
    });
    return Response.json({ success: true, orderNumber }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INSUFFICIENT_STOCK")
      return Response.json(
        { error: "A quantidade pedida já não está disponível." },
        { status: 409 },
      );
    if (code === "PRODUCT_UNAVAILABLE")
      return Response.json(
        { error: "Este produto já não está disponível." },
        { status: 404 },
      );
    console.error("[storefront-order]", error);
    return Response.json(
      { error: "Não foi possível registar a encomenda. Tente novamente." },
      { status: 500 },
    );
  }
}
