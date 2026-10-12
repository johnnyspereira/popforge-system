import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/service";
import { hasMinRole } from "@/lib/auth/roles";
import { resolveStorefrontContact } from "@/lib/commerce/storefront-contact";
import { selectRows, transaction } from "@/lib/mysql/db";

const clean = (value: unknown, limit = 500) => String(value ?? "").trim().slice(0, limit);
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

async function authContext() { const session = await getSession(); return session ? getAuthContext(session.user.id) : null; }

export async function GET() {
  const auth = await authContext();
  if (!auth) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const id = auth.account.id;
  const [inventory, jobs, orders, report] = await Promise.all([
    selectRows<RowDataPacket[]>("SELECT id,sku,item_type,name,material,color,unit,purchase_total,purchased_quantity,remaining_quantity,low_stock_threshold,active FROM commerce_inventory_items WHERE account_id=? AND active=TRUE ORDER BY item_type,name", [id]),
    selectRows<RowDataPacket[]>(`SELECT j.id,j.title,j.status,j.priority,j.due_date,j.printer_name,j.estimated_grams,j.actual_grams,j.estimated_minutes,j.actual_minutes,j.actual_labor_minutes,j.actual_energy_cost,j.actual_other_cost,j.internal_notes,j.created_at,o.order_number,i.product_name
      FROM commerce_production_jobs j LEFT JOIN commerce_orders o ON o.id=j.order_id LEFT JOIN commerce_order_items i ON i.id=j.order_item_id
      WHERE j.account_id=? ORDER BY FIELD(j.status,'printing','preparing','queued','post_processing','quality_check','completed','failed'),FIELD(j.priority,'urgent','high','normal','low'),j.due_date IS NULL,j.due_date,j.created_at DESC LIMIT 200`, [id]),
    selectRows<RowDataPacket[]>("SELECT id,order_number,customer_name,customer_email,total,payment_status,status,created_at FROM commerce_orders WHERE account_id=? ORDER BY created_at DESC LIMIT 100", [id]),
    selectRows<(RowDataPacket & { paid_revenue: string; pending_revenue: string; actual_material_cost: string; actual_other_cost: string; jobs_completed: number; low_stock: number })[]>(`SELECT
      (SELECT COALESCE(SUM(total),0) FROM commerce_orders WHERE account_id=? AND payment_status='paid') AS paid_revenue,
      (SELECT COALESCE(SUM(total),0) FROM commerce_orders WHERE account_id=? AND payment_status IN ('pending','partially_paid')) AS pending_revenue,
      (SELECT COALESCE(SUM(quantity*unit_cost),0) FROM commerce_production_material_usage WHERE account_id=? AND usage_type IN ('actual','waste')) AS actual_material_cost,
      (SELECT COALESCE(SUM(COALESCE(actual_energy_cost,0)+COALESCE(actual_other_cost,0)),0) FROM commerce_production_jobs WHERE account_id=?) AS actual_other_cost,
      (SELECT COUNT(*) FROM commerce_production_jobs WHERE account_id=? AND status='completed') AS jobs_completed,
      (SELECT COUNT(*) FROM commerce_inventory_items WHERE account_id=? AND active=TRUE AND remaining_quantity<=low_stock_threshold) AS low_stock`, [id, id, id, id, id, id]),
  ]);
  return Response.json({ inventory, jobs, orders, report: report[0] || {} });
}

export async function POST(request: Request) {
  const auth = await authContext();
  if (!auth) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, "agent")) return Response.json({ error: "Sem permissão para gerir a oficina." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = clean(body?.action, 50);
  try {
    if (action === "manual_order") return Response.json(await createManualOrder(auth, body));
    if (action === "consume_material") return Response.json(await consumeMaterial(auth, body));
    if (action === "update_job") return Response.json(await updateJob(auth, body));
    return Response.json({ error: "Operação inválida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const known: Record<string, string> = { INVALID_ORDER: "Preencha os dados do pedido manual.", INVENTORY_NOT_FOUND: "Item de stock não encontrado.", JOB_NOT_FOUND: "Trabalho de produção não encontrado.", INSUFFICIENT_STOCK: "Não existe stock suficiente para este consumo.", INVALID_JOB_STATUS: "Estado de produção inválido." };
    if (known[message]) return Response.json({ error: known[message] }, { status: message === "INSUFFICIENT_STOCK" ? 409 : 400 });
    console.error("[commerce-workshop]", error);
    return Response.json({ error: "Não foi possível guardar a operação." }, { status: 500 });
  }
}

async function createManualOrder(auth: NonNullable<Awaited<ReturnType<typeof authContext>>>, body: Record<string, unknown> | null) {
  const customerName = clean(body?.customerName, 180), customerEmail = clean(body?.customerEmail, 320).toLowerCase(), customerPhone = clean(body?.customerPhone, 40).replace(/[^+\d]/g, "");
  const productName = clean(body?.productName, 180), quantity = Math.max(1, Math.floor(number(body?.quantity, 1))), unitPrice = Math.max(0, number(body?.unitPrice));
  const paidAmount = Math.max(0, number(body?.paidAmount)); const total = Math.round(quantity * unitPrice * 100) / 100;
  if (!customerName || !customerEmail.includes("@") || customerPhone.length < 7 || !productName || total <= 0) throw new Error("INVALID_ORDER");
  const priority = ["low", "normal", "high", "urgent"].includes(clean(body?.priority, 12)) ? clean(body?.priority, 12) : "normal";
  return transaction(async (connection) => {
    const contact = await resolveStorefrontContact(connection, { accountId: auth.account.id, ownerUserId: auth.user.id, name: customerName, email: customerEmail, phone: customerPhone, create: true });
    const orderId = randomUUID(), itemId = randomUUID(), saleId = randomUUID(), jobId = randomUUID();
    const paymentStatus = paidAmount >= total ? "paid" : paidAmount > 0 ? "partially_paid" : "pending";
    await connection.execute<ResultSetHeader>("INSERT INTO finance_sales(id,account_id,contact_id,created_by_user_id,status,currency,subtotal,total_amount,paid_amount,balance_due,notes,completed_at) VALUES(?,?,?,?,?,'EUR',?,?,?,?,?,?)", [saleId, auth.account.id, contact?.contactId ?? null, auth.user.id, paymentStatus === "paid" ? "completed" : "open", total, total, Math.min(paidAmount, total), Math.max(0, total - paidAmount), clean(body?.notes, 5000) || null, paymentStatus === "paid" ? new Date() : null]);
    const [order] = await connection.execute<ResultSetHeader>("INSERT INTO commerce_orders(id,account_id,contact_id,finance_sale_id,status,payment_status,payment_method,channel,currency,subtotal,total,customer_name,customer_email,customer_phone,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [orderId, auth.account.id, contact?.contactId ?? null, saleId, paymentStatus === "paid" ? "confirmed" : "pending_payment", paymentStatus, clean(body?.paymentMethod, 64) || "manual", "backoffice", "EUR", total, total, customerName, customerEmail, customerPhone, clean(body?.notes, 5000) || null]);
    await connection.execute("INSERT INTO finance_sale_items(id,sale_id,account_id,item_type,name_snapshot,quantity,unit_price,line_total,metadata) VALUES(?,?,?,?,?,?,?,?,?)", [randomUUID(), saleId, auth.account.id, "3d_print", productName, quantity, unitPrice, total, JSON.stringify({ commerce_order_id: orderId })]);
    if (paidAmount > 0) await connection.execute("INSERT INTO finance_payments(id,account_id,sale_id,received_by_user_id,method,status,amount,reference_code,notes) VALUES(?,?,?,?,?,'confirmed',?,?,?)", [randomUUID(), auth.account.id, saleId, auth.user.id, clean(body?.paymentMethod, 32) || "manual", Math.min(paidAmount, total), `ORDER-${order.insertId}`, "Pagamento registado na encomenda manual POPForge"]);
    await connection.execute("INSERT INTO commerce_order_items(id,account_id,order_id,product_name,quantity,unit_price,line_total,customization) VALUES(?,?,?,?,?,?,?,?)", [itemId, auth.account.id, orderId, productName, quantity, unitPrice, total, JSON.stringify({ manual_entry: true })]);
    await connection.execute("INSERT INTO commerce_production_jobs(id,account_id,order_id,order_item_id,title,status,priority,due_date,printer_name,estimated_minutes,estimated_grams,internal_notes) VALUES(?,?,?,?,?,'queued',?,?,?,?,?,?)", [jobId, auth.account.id, orderId, itemId, productName, priority, clean(body?.dueDate, 10) || null, clean(body?.printerName, 120) || null, Math.max(0, Math.floor(number(body?.estimatedMinutes))), Math.max(0, number(body?.estimatedGrams)), clean(body?.productionNotes, 5000) || null]);
    await connection.execute("INSERT INTO commerce_order_history(id,account_id,order_id,actor_user_id,event_type,new_value,notes,metadata) VALUES(?,?,?,?,?,?,?,?)", [randomUUID(), auth.account.id, orderId, auth.user.id, "manual_order_created", paymentStatus, "Encomenda criada manualmente na oficina", JSON.stringify({ finance_sale_id: saleId, production_job_id: jobId })]);
    return { success: true, orderNumber: order.insertId, orderId, jobId };
  });
}

async function consumeMaterial(auth: NonNullable<Awaited<ReturnType<typeof authContext>>>, body: Record<string, unknown> | null) {
  const jobId = clean(body?.jobId, 36), inventoryId = clean(body?.inventoryId, 36), quantity = number(body?.quantity);
  if (!jobId || !inventoryId || quantity <= 0) throw new Error("INVENTORY_NOT_FOUND");
  return transaction(async (connection) => {
    const [jobs] = await connection.execute<RowDataPacket[]>("SELECT id FROM commerce_production_jobs WHERE id=? AND account_id=? FOR UPDATE", [jobId, auth.account.id]); if (!jobs[0]) throw new Error("JOB_NOT_FOUND");
    const [items] = await connection.execute<(RowDataPacket & { sku: string; name: string; remaining_quantity: string; purchase_total: string; purchased_quantity: string })[]>("SELECT sku,name,remaining_quantity,purchase_total,purchased_quantity FROM commerce_inventory_items WHERE id=? AND account_id=? AND active=TRUE FOR UPDATE", [inventoryId, auth.account.id]); const item = items[0]; if (!item) throw new Error("INVENTORY_NOT_FOUND");
    if (Number(item.remaining_quantity) < quantity) throw new Error("INSUFFICIENT_STOCK");
    const unitCost = Number(item.purchased_quantity) > 0 ? Number(item.purchase_total) / Number(item.purchased_quantity) : 0;
    const usageType = clean(body?.usageType, 12) === "waste" ? "waste" : "actual";
    await connection.execute("UPDATE commerce_inventory_items SET remaining_quantity=remaining_quantity-? WHERE id=?", [quantity, inventoryId]);
    await connection.execute("INSERT INTO commerce_production_material_usage(id,account_id,production_job_id,inventory_item_id,usage_type,quantity,unit_cost,item_sku,item_name,notes,recorded_by_user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)", [randomUUID(), auth.account.id, jobId, inventoryId, usageType, quantity, unitCost, item.sku, item.name, clean(body?.notes, 2000) || null, auth.user.id]);
    await connection.execute("INSERT INTO commerce_stock_movements(id,account_id,inventory_item_id,movement_type,quantity,reference,notes,created_by) VALUES(?,?,?,'exit',?,?,?,?)", [randomUUID(), auth.account.id, inventoryId, -quantity, `PRODUCTION-${jobId}`, `${usageType === "waste" ? "Perda" : "Consumo"}: ${clean(body?.notes, 500) || item.name}`, auth.user.id]);
    await connection.execute("UPDATE commerce_production_jobs SET actual_grams=COALESCE(actual_grams,0)+?,actual_other_cost=COALESCE(actual_other_cost,0)+? WHERE id=?", [clean(body?.unit, 20) === "gram" ? quantity : 0, quantity * unitCost, jobId]);
    return { success: true, unitCost, cost: quantity * unitCost };
  });
}

async function updateJob(auth: NonNullable<Awaited<ReturnType<typeof authContext>>>, body: Record<string, unknown> | null) {
  const jobId = clean(body?.jobId, 36); const status = clean(body?.status, 30); const allowed = new Set(["queued", "preparing", "printing", "post_processing", "quality_check", "completed", "failed"]);
  if (!jobId || !allowed.has(status)) throw new Error("INVALID_JOB_STATUS");
  const actualMinutes = body?.actualMinutes === undefined ? null : Math.max(0, Math.floor(number(body?.actualMinutes)));
  const laborMinutes = body?.laborMinutes === undefined ? null : Math.max(0, Math.floor(number(body?.laborMinutes)));
  const energyCost = body?.energyCost === undefined ? null : Math.max(0, number(body?.energyCost));
  const otherCost = body?.otherCost === undefined ? null : Math.max(0, number(body?.otherCost));
  const [result] = await transaction(async (connection) => connection.execute<ResultSetHeader>("UPDATE commerce_production_jobs SET status=?,printer_name=?,actual_minutes=COALESCE(?,actual_minutes),actual_labor_minutes=COALESCE(?,actual_labor_minutes),actual_energy_cost=COALESCE(?,actual_energy_cost),actual_other_cost=COALESCE(?,actual_other_cost),internal_notes=?,started_at=CASE WHEN ?='printing' AND started_at IS NULL THEN UTC_TIMESTAMP(3) ELSE started_at END,completed_at=CASE WHEN ? IN ('completed','failed') THEN UTC_TIMESTAMP(3) ELSE completed_at END WHERE id=? AND account_id=?", [status, clean(body?.printerName, 120) || null, actualMinutes, laborMinutes, energyCost, otherCost, clean(body?.notes, 5000) || null, status, status, jobId, auth.account.id]));
  if (!result.affectedRows) throw new Error("JOB_NOT_FOUND"); return { success: true };
}
