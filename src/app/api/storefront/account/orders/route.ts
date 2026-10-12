import type { RowDataPacket } from "mysql2";
import { getCustomerSession } from "@/lib/commerce/customer-session";
import { selectRows } from "@/lib/mysql/db";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return Response.json({ error: "Sessão de cliente inválida." }, { status: 401 });

  const [orders, requests, quotes, profile] = await Promise.all([
    selectRows<(RowDataPacket & { id: string; order_number: number; status: string; payment_status: string; payment_method: string | null; total: string; created_at: string; tracking_code: string | null; delivery_method: string | null; delivery_status: string; estimated_dispatch_at: string | null; shipping_address: string | null; items: string | null; history: string | null })[]>(
      `SELECT o.id,o.order_number,o.status,o.payment_status,o.payment_method,o.total,o.created_at,o.tracking_code,o.delivery_method,o.delivery_status,o.estimated_dispatch_at,o.shipping_address,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('name',i.product_name,'quantity',i.quantity,'total',i.line_total)) FROM commerce_order_items i WHERE i.order_id=o.id) AS items,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('event',h.event_type,'value',h.new_value,'notes',h.notes,'createdAt',h.created_at)) FROM commerce_order_history h WHERE h.order_id=o.id ORDER BY h.created_at DESC LIMIT 8) AS history
       FROM commerce_orders o WHERE o.account_id=? AND o.contact_id=? ORDER BY o.created_at DESC`, [session.accountId, session.contactId],
    ),
    selectRows<(RowDataPacket & { id: string; request_type: string; status: string; description: string; created_at: string; quantity: number; attachments: string | null })[]>(
      "SELECT id,request_type,status,description,quantity,attachments,created_at FROM commerce_custom_requests WHERE account_id=? AND contact_id=? ORDER BY created_at DESC", [session.accountId, session.contactId],
    ),
    selectRows<(RowDataPacket & { id: string; quote_number: number; status: string; total: string; valid_until: string | null; created_at: string; request_id: string | null; order_id: string | null })[]>(
      "SELECT id,quote_number,status,total,valid_until,created_at,request_id,order_id FROM commerce_quotes WHERE account_id=? AND contact_id=? ORDER BY created_at DESC", [session.accountId, session.contactId],
    ),
    selectRows<(RowDataPacket & { name: string | null; email: string; phone: string | null })[]>(
      "SELECT name,email,phone FROM contacts WHERE id=? AND account_id=? LIMIT 1", [session.contactId, session.accountId],
    ),
  ]);
  return Response.json({ customer: { name: profile[0]?.name ?? session.name, email: profile[0]?.email ?? session.email, phone: profile[0]?.phone ?? null }, orders, requests, quotes });
}
