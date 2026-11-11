import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { getStripeClient, toStripeAmount } from "@/lib/finance/stripe";
import { selectRows, transaction } from "@/lib/mysql/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { clientIp } from "@/lib/commerce/storefront-contact";

type OrderRow = RowDataPacket & {
  id: string; account_id: string; finance_sale_id: string | null; customer_email: string | null;
  customer_name: string | null; total: string | number; payment_status: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limit = checkRateLimit(`storefront-payment:${clientIp(request)}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!limit.success) return rateLimitResponse(limit);
  const body = (await request.json().catch(() => null)) as { orderId?: string; email?: string } | null;
  const orderId = String(body?.orderId || "").slice(0, 36);
  const email = String(body?.email || "").trim().toLowerCase().slice(0, 320);
  if (!orderId || !email.includes("@")) return Response.json({ error: "Dados de pagamento inválidos." }, { status: 400 });

  const orders = await selectRows<OrderRow[]>(
    "SELECT id,account_id,finance_sale_id,customer_email,customer_name,total,payment_status FROM commerce_orders WHERE id=? AND customer_email=? LIMIT 1",
    [orderId, email],
  );
  const order = orders[0];
  if (!order?.finance_sale_id) return Response.json({ error: "A encomenda não está disponível para pagamento online." }, { status: 404 });
  if (order.payment_status === "paid") return Response.json({ error: "Esta encomenda já está paga." }, { status: 409 });
  const amount = Number(order.total);
  if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: "O valor da encomenda é inválido." }, { status: 400 });

  const linkId = randomUUID();
  try {
    const origin = new URL(request.url).origin;
    await transaction(async (connection) => {
      await connection.execute(
        "INSERT INTO finance_payment_links(id,account_id,sale_id,provider,status,amount,currency,description,external_reference,created_by_user_id) VALUES(?,?,?,'stripe','pending',?,'EUR',?,?,NULL)",
        [linkId, order.account_id, order.finance_sale_id, amount, `Encomenda #${order.id.slice(0, 8)}`, `commerce-order-${order.id}`],
      );
    });
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin}/checkout?payment=success`,
      cancel_url: `${origin}/checkout?payment=cancelled`,
      customer_email: order.customer_email || undefined,
      client_reference_id: linkId,
      metadata: { payment_link_id: linkId, commerce_order_id: order.id, finance_sale_id: order.finance_sale_id },
      payment_intent_data: { metadata: { payment_link_id: linkId, commerce_order_id: order.id, finance_sale_id: order.finance_sale_id } },
      line_items: [{ quantity: 1, price_data: { currency: "EUR", unit_amount: toStripeAmount(amount, "EUR"), product_data: { name: "Encomenda POPForge", description: order.customer_name || undefined } } }],
    });
    await transaction(async (connection) => {
      await connection.execute(
        "UPDATE finance_payment_links SET payment_url=?,external_session_id=?,external_payment_intent_id=?,provider_payload=? WHERE id=?",
        [session.url, session.id, typeof session.payment_intent === "string" ? session.payment_intent : null, JSON.stringify({ checkout_session_id: session.id, commerce_order_id: order.id }), linkId],
      );
    });
    return Response.json({ checkoutUrl: session.url });
  } catch (error) {
    await transaction(async (connection) => {
      await connection.execute("UPDATE finance_payment_links SET status='failed',provider_payload=? WHERE id=?", [JSON.stringify({ error: error instanceof Error ? error.message : "Stripe error" }), linkId]);
    }).catch(() => undefined);
    return Response.json({ error: "Não foi possível iniciar o pagamento por cartão. Escolha outro método ou tente novamente." }, { status: 503 });
  }
}
