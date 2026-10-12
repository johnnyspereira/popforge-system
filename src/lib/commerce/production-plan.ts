import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

type Item = RowDataPacket & { id: string; product_name: string; quantity: number; production_minutes: number | null; production_grams: number | null; production_material_sku: string | null; production_printer_name: string | null; inventory_id: string | null; inventory_sku: string | null; inventory_name: string | null; purchase_total: number | null; purchased_quantity: number | null };

/** Creates one queued job per order item, including only explicit product defaults. */
export async function createProductionPlan(connection: PoolConnection, input: { accountId: string; orderId: string; actorUserId?: string | null }) {
  const [printers] = await connection.execute<(RowDataPacket & { name: string })[]>("SELECT name FROM commerce_printers WHERE account_id=? ORDER BY status='idle' DESC,last_seen_at DESC,created_at ASC LIMIT 1", [input.accountId]);
  const defaultPrinter = printers[0]?.name ?? null;
  const [items] = await connection.execute<Item[]>(`SELECT i.id,i.product_name,i.quantity,v.production_minutes,v.production_grams,v.production_material_sku,v.production_printer_name,
      inv.id AS inventory_id,inv.sku AS inventory_sku,inv.name AS inventory_name,inv.purchase_total,inv.purchased_quantity
    FROM commerce_order_items i
    LEFT JOIN commerce_product_variants v ON v.id=i.variant_id
    LEFT JOIN commerce_inventory_items inv ON inv.account_id=i.account_id AND inv.sku=v.production_material_sku AND inv.active=TRUE
    WHERE i.order_id=? AND i.account_id=?`, [input.orderId, input.accountId]);
  let created = 0;
  for (const item of items) {
    const [existing] = await connection.execute<RowDataPacket[]>("SELECT id FROM commerce_production_jobs WHERE order_item_id=? LIMIT 1", [item.id]);
    if (existing[0]) continue;
    const minutes = item.production_minutes === null ? null : Math.max(0, Number(item.production_minutes) * Number(item.quantity));
    const grams = item.production_grams === null ? null : Math.max(0, Number(item.production_grams) * Number(item.quantity));
    const jobId = randomUUID();
    await connection.execute("INSERT INTO commerce_production_jobs(id,account_id,order_id,order_item_id,title,status,printer_name,material_inventory_id,estimated_minutes,estimated_grams) VALUES(?,?,?,?,?,'queued',?,?,?,?)", [jobId, input.accountId, input.orderId, item.id, item.product_name, item.production_printer_name || defaultPrinter, item.inventory_id, minutes, grams]);
    if (item.inventory_id && grams && grams > 0) {
      const unitCost = Number(item.purchased_quantity) > 0 ? Number(item.purchase_total || 0) / Number(item.purchased_quantity) : 0;
      await connection.execute("INSERT INTO commerce_production_material_usage(id,account_id,production_job_id,inventory_item_id,usage_type,quantity,unit_cost,item_sku,item_name,notes,recorded_by_user_id) VALUES(?,?,?,?, 'planned',?,?,?,?,?,?)", [randomUUID(), input.accountId, jobId, item.inventory_id, grams, unitCost, item.inventory_sku, item.inventory_name, "Planeado automaticamente a partir da ficha do produto", input.actorUserId || null]);
    }
    created++;
  }
  return { created };
}
