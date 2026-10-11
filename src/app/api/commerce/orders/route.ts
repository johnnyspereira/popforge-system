import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/service";
import { hasMinRole } from "@/lib/auth/roles";
import { selectRows, transaction } from "@/lib/mysql/db";

type OrderRow = RowDataPacket & {
  id: string; order_number: number; status: string; payment_status: string; channel: string;
  total: string | number; customer_name: string | null; customer_email: string | null;
  customer_phone: string | null; created_at: string; items: number;
};

async function authContext() {
  const session = await getSession();
  return session ? getAuthContext(session.user.id) : null;
}

export async function GET(request: Request) {
  const auth = await authContext();
  if (!auth) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const orders = await selectRows<(OrderRow & { notes: string | null; shipping_address: string | null; tracking_code: string | null })[]>(
      "SELECT id,order_number,status,payment_status,channel,total,customer_name,customer_email,customer_phone,created_at,notes,shipping_address,tracking_code,0 AS items FROM commerce_orders WHERE id=? AND account_id=? LIMIT 1", [id, auth.account.id],
    );
    const order = orders[0];
    if (!order) return Response.json({ error: "Encomenda não encontrada." }, { status: 404 });
    const [items, history, jobs] = await Promise.all([
      selectRows<RowDataPacket[]>("SELECT id,product_name,sku,quantity,unit_price,line_total,customization FROM commerce_order_items WHERE order_id=? ORDER BY created_at", [id]),
      selectRows<RowDataPacket[]>("SELECT h.id,h.event_type,h.previous_value,h.new_value,h.notes,h.created_at,p.full_name AS actor_name FROM commerce_order_history h LEFT JOIN profiles p ON p.user_id=h.actor_user_id WHERE h.order_id=? ORDER BY h.created_at DESC", [id]),
      selectRows<RowDataPacket[]>("SELECT j.id,j.status,j.printer_name,j.estimated_minutes,j.actual_minutes,j.created_at,i.product_name FROM commerce_production_jobs j LEFT JOIN commerce_order_items i ON i.id=j.order_item_id WHERE j.order_item_id IN (SELECT id FROM commerce_order_items WHERE order_id=?) ORDER BY j.created_at DESC", [id]),
    ]);
    return Response.json({ order, items, history, jobs });
  }
  const orders = await selectRows<OrderRow[]>(
    `SELECT o.id,o.order_number,o.status,o.payment_status,o.channel,o.total,o.customer_name,o.customer_email,o.customer_phone,o.created_at,COUNT(i.id) AS items
       FROM commerce_orders o LEFT JOIN commerce_order_items i ON i.order_id=o.id
      WHERE o.account_id=? GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`, [auth.account.id],
  );
  return Response.json({ orders });
}

export async function PATCH(request: Request) {
  const auth = await authContext();
  if (!auth) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, "agent")) return Response.json({ error: "Sem permissão para gerir encomendas." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: string; status?: string; paymentStatus?: string; notes?: string } | null;
  const allowed = new Set(["pending_payment", "paid", "in_production", "quality_check", "ready_to_ship", "shipped", "delivered", "cancelled", "refunded"]);
  if (!body?.id || !body.status || !allowed.has(body.status)) return Response.json({ error: "Estado de encomenda inválido." }, { status: 400 });
  const orderId = body.id;
  const nextStatus = body.status;
  try {
    await transaction(async (connection) => {
      const [rows] = await connection.execute<(RowDataPacket & { status: string; payment_status: string })[]>("SELECT status,payment_status FROM commerce_orders WHERE id=? AND account_id=? FOR UPDATE", [orderId, auth.account.id]);
      const current = rows[0]; if (!current) throw new Error("NOT_FOUND");
      const payment = body.paymentStatus && ["pending", "paid", "partially_paid", "refunded", "failed", "cancelled"].includes(body.paymentStatus) ? body.paymentStatus : current.payment_status;
      await connection.execute<ResultSetHeader>("UPDATE commerce_orders SET status=?,payment_status=?,paid_at=CASE WHEN ?='paid' AND paid_at IS NULL THEN UTC_TIMESTAMP(3) ELSE paid_at END WHERE id=?", [nextStatus, payment, payment, orderId]);
      await connection.execute("INSERT INTO commerce_order_history(id,account_id,order_id,actor_user_id,event_type,previous_value,new_value,notes) VALUES(?,?,?,?,?,?,?,?)", [randomUUID(), auth.account.id, orderId, auth.user.id, "status_changed", current.status, nextStatus, String(body.notes || "") || null]);
      if (nextStatus === "in_production") {
        const [items] = await connection.execute<(RowDataPacket & { id: string })[]>("SELECT id FROM commerce_order_items WHERE order_id=?", [orderId]);
        for (const item of items) {
          const [existing] = await connection.execute<RowDataPacket[]>("SELECT id FROM commerce_production_jobs WHERE order_item_id=? LIMIT 1", [item.id]);
          if (!existing[0]) await connection.execute("INSERT INTO commerce_production_jobs(id,account_id,order_item_id,status) VALUES(?,?,?,'queued')", [randomUUID(), auth.account.id, item.id]);
        }
      }
    });
    return Response.json({ success: true });
  } catch (error) { if (error instanceof Error && error.message === "NOT_FOUND") return Response.json({ error: "Encomenda não encontrada." }, { status: 404 }); console.error("[commerce-order-update]", error); return Response.json({ error: "Não foi possível atualizar a encomenda." }, { status: 500 }); }
}
