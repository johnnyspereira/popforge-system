import type { RowDataPacket } from "mysql2";
import { clearCustomerSession, establishCustomerSession, getCustomerSession } from "@/lib/commerce/customer-session";
import { selectRows } from "@/lib/mysql/db";

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
export async function GET() {
  const session = await getCustomerSession();
  if (!session) return Response.json({ authenticated: false }, { status: 401 });
  return Response.json({ authenticated: true, customer: { name: session.name, email: session.email } });
}
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; orderNumber?: string | number } | null;
  const email = clean(body?.email, 320).toLowerCase(); const orderNumber = Number(body?.orderNumber);
  if (!email.includes("@") || !Number.isSafeInteger(orderNumber) || orderNumber < 1) return Response.json({ error: "Indique o e-mail usado na compra e o número da encomenda." }, { status: 400 });
  const rows = await selectRows<(RowDataPacket & { account_id: string; contact_id: string })[]>("SELECT account_id,contact_id FROM commerce_orders WHERE customer_email=? AND order_number=? AND contact_id IS NOT NULL LIMIT 1", [email, orderNumber]);
  const order = rows[0];
  if (!order) return Response.json({ error: "Não encontrámos uma encomenda com estes dados." }, { status: 404 });
  await establishCustomerSession(order.account_id, order.contact_id);
  return Response.json({ success: true });
}
export async function DELETE() { await clearCustomerSession(); return Response.json({ success: true }); }
