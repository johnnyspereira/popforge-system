import type { RowDataPacket } from "mysql2";
import { getCustomerSession } from "@/lib/commerce/customer-session";
import { selectRows } from "@/lib/mysql/db";
export async function GET() {
  const session = await getCustomerSession();
  if (!session) return Response.json({ error: "Sessão de cliente inválida." }, { status: 401 });
  const orders = await selectRows<(RowDataPacket & { id: string; order_number: number; status: string; payment_status: string; total: string; created_at: string; items: string | null })[]>(
    `SELECT o.id,o.order_number,o.status,o.payment_status,o.total,o.created_at,
      (SELECT JSON_ARRAYAGG(JSON_OBJECT('name',i.product_name,'quantity',i.quantity,'total',i.line_total)) FROM commerce_order_items i WHERE i.order_id=o.id) AS items
      FROM commerce_orders o WHERE o.account_id=? AND o.contact_id=? ORDER BY o.created_at DESC`, [session.accountId, session.contactId],
  );
  const requests = await selectRows<(RowDataPacket & { id: string; request_type: string; status: string; description: string; created_at: string })[]>("SELECT id,request_type,status,description,created_at FROM commerce_custom_requests WHERE account_id=? AND contact_id=? ORDER BY created_at DESC", [session.accountId, session.contactId]);
  return Response.json({ customer: { name: session.name, email: session.email }, orders, requests });
}
