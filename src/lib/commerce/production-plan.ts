import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

type Item = RowDataPacket & { id: string; variant_id: string | null; product_name: string; quantity: number; production_minutes: number | null; production_grams: number | null; production_material_sku: string | null; production_printer_name: string | null; inventory_id: string | null; inventory_sku: string | null; inventory_name: string | null; purchase_total: number | null; purchased_quantity: number | null };
type Component = Item & { kit_component_id: string; component_quantity: number };

/** Creates one queued job per order item, including only explicit product defaults. */
export async function createProductionPlan(connection: PoolConnection, input: { accountId: string; orderId: string; actorUserId?: string | null }) {
  const [printers] = await connection.execute<(RowDataPacket & { id: string; name: string })[]>("SELECT id,name FROM commerce_printers WHERE account_id=? ORDER BY status='idle' DESC,last_seen_at DESC,created_at ASC LIMIT 1", [input.accountId]);
  const defaultPrinter = printers[0] ?? null;
  const [items] = await connection.execute<Item[]>(`SELECT i.id,i.variant_id,i.product_name,i.quantity,v.production_minutes,v.production_grams,v.production_material_sku,v.production_printer_name,
      inv.id AS inventory_id,inv.sku AS inventory_sku,inv.name AS inventory_name,inv.purchase_total,inv.purchased_quantity
    FROM commerce_order_items i
    LEFT JOIN commerce_product_variants v ON v.id=i.variant_id
    LEFT JOIN commerce_inventory_items inv ON inv.account_id=i.account_id AND inv.sku=v.production_material_sku AND inv.active=TRUE
    WHERE i.order_id=? AND i.account_id=?`, [input.orderId, input.accountId]);
  let created = 0;
  for (const item of items) {
    let components: Component[] = [];
    let kitSchemaAvailable = true;
    try {
      const [rows] = await connection.execute<Component[]>(`SELECT kc.id AS kit_component_id,kc.quantity AS component_quantity,i.id,i.variant_id,p.name AS product_name,
        v.production_minutes,v.production_grams,v.production_material_sku,v.production_printer_name,
        inv.id AS inventory_id,inv.sku AS inventory_sku,inv.name AS inventory_name,inv.purchase_total,inv.purchased_quantity
      FROM commerce_product_kit_components kc JOIN commerce_product_variants v ON v.id=kc.component_variant_id JOIN commerce_products p ON p.id=v.product_id
      LEFT JOIN commerce_inventory_items inv ON inv.account_id=kc.account_id AND inv.sku=v.production_material_sku AND inv.active=TRUE
      JOIN commerce_order_items i ON i.id=? WHERE kc.kit_variant_id=? AND kc.account_id=? ORDER BY kc.sort_order,kc.created_at`, [item.id, item.variant_id, input.accountId]);
      components = rows;
    } catch (error) {
      // Older installations can receive an order before migration 064. A
      // normal product must still be purchasable while that migration runs.
      if (!isMissingSchema(error)) throw error;
      kitSchemaAvailable = false;
    }
    const plans = components.length ? components : [item];
    for (const plan of plans) {
      const kitComponentId = "kit_component_id" in plan ? plan.kit_component_id : null;
      const componentQuantity = "component_quantity" in plan ? Number(plan.component_quantity) : 1;
      const [existing] = kitSchemaAvailable
        ? await connection.execute<RowDataPacket[]>("SELECT id FROM commerce_production_jobs WHERE order_item_id=? AND kit_component_id <=> ? LIMIT 1", [item.id, kitComponentId])
        : await connection.execute<RowDataPacket[]>("SELECT id FROM commerce_production_jobs WHERE order_item_id=? LIMIT 1", [item.id]);
      if (existing[0]) continue;
      const quantity = Number(item.quantity) * componentQuantity;
      const minutes = plan.production_minutes === null ? null : Math.max(0, Number(plan.production_minutes) * quantity);
      const grams = plan.production_grams === null ? null : Math.max(0, Number(plan.production_grams) * quantity);
      const jobId = randomUUID();
      if (kitSchemaAvailable) {
        await connection.execute("INSERT INTO commerce_production_jobs(id,account_id,order_id,order_item_id,kit_component_id,title,status,printer_id,printer_name,material_inventory_id,estimated_minutes,estimated_grams) VALUES(?,?,?,?,?,?,'queued',?,?,?,?,?)", [jobId, input.accountId, input.orderId, item.id, kitComponentId, plan.product_name, defaultPrinter?.id || null, plan.production_printer_name || defaultPrinter?.name || null, plan.inventory_id, minutes, grams]);
      } else {
        await connection.execute("INSERT INTO commerce_production_jobs(id,account_id,order_id,order_item_id,title,status,printer_id,printer_name,material_inventory_id,estimated_minutes,estimated_grams) VALUES(?,?,?,?,?,'queued',?,?,?,?,?)", [jobId, input.accountId, input.orderId, item.id, plan.product_name, defaultPrinter?.id || null, plan.production_printer_name || defaultPrinter?.name || null, plan.inventory_id, minutes, grams]);
      }
      for (let unitNumber = 1; unitNumber <= quantity; unitNumber += 1) await connection.execute("INSERT INTO commerce_production_units(id,account_id,production_job_id,unit_number,status) VALUES(?,?,?,?,'pending')", [randomUUID(), input.accountId, jobId, unitNumber]);
      if (plan.inventory_id && grams && grams > 0) {
        const unitCost = Number(plan.purchased_quantity) > 0 ? Number(plan.purchase_total || 0) / Number(plan.purchased_quantity) : 0;
        await connection.execute("INSERT INTO commerce_production_material_usage(id,account_id,production_job_id,inventory_item_id,usage_type,quantity,unit_cost,item_sku,item_name,notes,recorded_by_user_id) VALUES(?,?,?,?, 'planned',?,?,?,?,?,?)", [randomUUID(), input.accountId, jobId, plan.inventory_id, grams, unitCost, plan.inventory_sku, plan.inventory_name, kitComponentId ? "Peça de kit planeada automaticamente" : "Planeado automaticamente a partir da ficha do produto", input.actorUserId || null]);
      }
      created++;
    }
  }
  return { created };
}

function isMissingSchema(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR" || code === "ER_TABLEACCESS_DENIED_ERROR";
}
