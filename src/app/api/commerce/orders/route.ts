import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/service";
import { hasMinRole } from "@/lib/auth/roles";
import { selectRows, transaction } from "@/lib/mysql/db";
import { canTransitionOrder, isOrderStatus, isPaymentStatus, ORDER_STATUS_LABELS, stockEffectFor, type StockState } from "@/lib/commerce/order-status";
import { settleOrderStock } from "@/lib/commerce/stock";
import { sendOrderUpdateEmail } from "@/lib/commerce/order-communication";
import { createProductionPlan } from "@/lib/commerce/production-plan";

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
      "SELECT id,order_number,status,payment_status,payment_method,delivery_method,delivery_status,estimated_dispatch_at,stock_state,customer_review_required,contact_id,channel,total,customer_name,customer_email,customer_phone,created_at,notes,shipping_address,tracking_code,0 AS items FROM commerce_orders WHERE id=? AND account_id=? LIMIT 1", [id, auth.account.id],
    );
    const order = orders[0];
    if (!order) return Response.json({ error: "Encomenda não encontrada." }, { status: 404 });
    const [items, history, jobs] = await Promise.all([
      selectRows<RowDataPacket[]>("SELECT id,product_name,sku,quantity,unit_price,line_total,customization FROM commerce_order_items WHERE order_id=? ORDER BY created_at", [id]),
      selectRows<RowDataPacket[]>("SELECT h.id,h.event_type,h.previous_value,h.new_value,h.notes,h.created_at,p.full_name AS actor_name FROM commerce_order_history h LEFT JOIN profiles p ON p.user_id=h.actor_user_id WHERE h.order_id=? ORDER BY h.created_at DESC", [id]),
      selectRows<RowDataPacket[]>(`SELECT j.id,j.status,j.printer_name,j.printer_file,j.printer_progress_percent,j.printer_last_seen_at,j.estimated_minutes,j.actual_minutes,j.created_at,i.product_name,p.name AS assigned_printer,
        (SELECT COUNT(*) FROM commerce_production_files f WHERE f.production_job_id=j.id) AS internal_files
        FROM commerce_production_jobs j LEFT JOIN commerce_order_items i ON i.id=j.order_item_id LEFT JOIN commerce_printers p ON p.id=j.printer_id
        WHERE j.order_id=? OR j.order_item_id IN (SELECT id FROM commerce_order_items WHERE order_id=?) ORDER BY j.created_at DESC`, [id, id]),
    ]);
    return Response.json({ order, items, history, jobs });
  }
  const orders = await selectRows<OrderRow[]>(
    `SELECT o.id,o.order_number,o.status,o.payment_status,o.customer_review_required,o.channel,o.total,o.customer_name,o.customer_email,o.customer_phone,o.created_at,COUNT(i.id) AS items
       FROM commerce_orders o LEFT JOIN commerce_order_items i ON i.order_id=o.id
      WHERE o.account_id=? GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200`, [auth.account.id],
  );
  return Response.json({ orders });
}

export async function PATCH(request: Request) {
  const auth = await authContext();
  if (!auth) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, "agent")) return Response.json({ error: "Sem permissão para gerir encomendas." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: string; status?: string; paymentStatus?: string; notes?: string; trackingCode?: string; deliveryStatus?: string; estimatedDispatchAt?: string } | null;
  if (!body?.id) return Response.json({ error: "Encomenda inválida." }, { status: 400 });
  if (body.status !== undefined && !isOrderStatus(body.status)) return Response.json({ error: "Estado de encomenda inválido." }, { status: 400 });
  if (body.paymentStatus !== undefined && !isPaymentStatus(body.paymentStatus)) return Response.json({ error: "Estado de pagamento inválido." }, { status: 400 });
  const deliveryStatuses = new Set(["pending", "preparing", "shipped", "delivered", "issue"]);
  if (body.deliveryStatus !== undefined && !deliveryStatuses.has(body.deliveryStatus)) return Response.json({ error: "Estado de entrega inválido." }, { status: 400 });
  if (body.status === undefined && body.paymentStatus === undefined && body.trackingCode === undefined && body.deliveryStatus === undefined && body.estimatedDispatchAt === undefined) return Response.json({ error: "Indique a alteração a guardar." }, { status: 400 });
  // Recording money as received is a financial act: restricted to admins.
  if (body.paymentStatus !== undefined && !hasMinRole(auth.profile.account_role, "admin")) return Response.json({ error: "Apenas administradores podem alterar o estado do pagamento." }, { status: 403 });
  const orderId = body.id;
  const notes = String(body.notes || "").trim().slice(0, 2000) || null;
  const customerUpdates: Array<{ to: string | null; name: string | null; orderNumber: number; kind: "status" | "payment"; value: string }> = [];
  try {
    await transaction(async (connection) => {
      const [rows] = await connection.execute<(RowDataPacket & { status: string; payment_status: string; stock_state: StockState; order_number: number; customer_email: string | null; customer_name: string | null })[]>("SELECT status,payment_status,stock_state,order_number,customer_email,customer_name FROM commerce_orders WHERE id=? AND account_id=? FOR UPDATE", [orderId, auth.account.id]);
      const current = rows[0]; if (!current) throw new Error("NOT_FOUND");
      const nextStatus = body.status && body.status !== current.status ? body.status : null;
      const nextPayment = body.paymentStatus && body.paymentStatus !== current.payment_status ? body.paymentStatus : null;
      if (nextStatus && !canTransitionOrder(current.status, nextStatus)) throw new Error("INVALID_TRANSITION");
      if (nextStatus && isOrderStatus(nextStatus)) {
        await connection.execute<ResultSetHeader>("UPDATE commerce_orders SET status=? WHERE id=?", [nextStatus, orderId]);
        const effect = stockEffectFor(nextStatus, current.stock_state);
        if (effect) await settleOrderStock(connection, { accountId: auth.account.id, orderId, effect, actorUserId: auth.user.id, reference: `ORDER-${current.order_number}` });
        await connection.execute("INSERT INTO commerce_order_history(id,account_id,order_id,actor_user_id,event_type,previous_value,new_value,notes) VALUES(?,?,?,?,?,?,?,?)", [randomUUID(), auth.account.id, orderId, auth.user.id, "status_changed", current.status, nextStatus, notes]);
        customerUpdates.push({ to: current.customer_email, name: current.customer_name, orderNumber: current.order_number, kind: "status", value: nextStatus });
        if (nextStatus === "in_production") {
          await createProductionPlan(connection, { accountId: auth.account.id, orderId, actorUserId: auth.user.id });
        }
      }
      if (nextPayment) {
        await connection.execute<ResultSetHeader>("UPDATE commerce_orders SET payment_status=?,paid_at=CASE WHEN ?='paid' AND paid_at IS NULL THEN UTC_TIMESTAMP(3) ELSE paid_at END WHERE id=?", [nextPayment, nextPayment, orderId]);
        await connection.execute("INSERT INTO commerce_order_history(id,account_id,order_id,actor_user_id,event_type,previous_value,new_value,notes) VALUES(?,?,?,?,?,?,?,?)", [randomUUID(), auth.account.id, orderId, auth.user.id, "payment_changed", current.payment_status, nextPayment, notes]);
        customerUpdates.push({ to: current.customer_email, name: current.customer_name, orderNumber: current.order_number, kind: "payment", value: nextPayment });
      }
      const trackingCode = body.trackingCode === undefined ? undefined : String(body.trackingCode).trim().slice(0, 160) || null;
      const deliveryStatus = body.deliveryStatus === undefined ? undefined : body.deliveryStatus;
      const estimatedDispatchAt = body.estimatedDispatchAt === undefined ? undefined : String(body.estimatedDispatchAt).trim().slice(0, 10) || null;
      if (trackingCode !== undefined || deliveryStatus !== undefined || estimatedDispatchAt !== undefined) {
        await connection.execute("UPDATE commerce_orders SET tracking_code=IF(?,?,tracking_code),delivery_status=IF(?,?,delivery_status),estimated_dispatch_at=IF(?,?,estimated_dispatch_at) WHERE id=?", [trackingCode !== undefined, trackingCode ?? null, deliveryStatus !== undefined, deliveryStatus ?? null, estimatedDispatchAt !== undefined, estimatedDispatchAt ?? null, orderId]);
        await connection.execute("INSERT INTO commerce_order_history(id,account_id,order_id,actor_user_id,event_type,notes,metadata) VALUES(?,?,?,?,?,?,?)", [randomUUID(), auth.account.id, orderId, auth.user.id, "fulfillment_updated", notes || "Dados de expedição atualizados", JSON.stringify({ tracking_code: trackingCode, delivery_status: deliveryStatus, estimated_dispatch_at: estimatedDispatchAt })]);
      }
      if (!nextStatus && !nextPayment && trackingCode === undefined && deliveryStatus === undefined && estimatedDispatchAt === undefined) throw new Error("UNCHANGED");
    });
    await Promise.all(customerUpdates.map(update => sendOrderUpdateEmail(update)));
    return Response.json({ success: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return Response.json({ error: "Encomenda não encontrada." }, { status: 404 });
    if (code === "INVALID_TRANSITION") return Response.json({ error: `Não é possível passar para "${ORDER_STATUS_LABELS[body.status as keyof typeof ORDER_STATUS_LABELS] ?? body.status}" a partir do estado atual.` }, { status: 409 });
    if (code === "UNCHANGED") return Response.json({ success: true, unchanged: true });
    console.error("[commerce-order-update]", error);
    return Response.json({ error: "Não foi possível atualizar a encomenda." }, { status: 500 });
  }
}
