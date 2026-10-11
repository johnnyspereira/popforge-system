import "server-only";

import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import type { StockEffect } from "./order-status";

// Variant stock model:
//   stock_quantity  = available to sell (already excludes reservations)
//   stock_reserved  = held by open orders, still physically in the workshop
// Each order settles its reservation exactly once, guarded by
// commerce_orders.stock_state under a row lock.

export class InsufficientStockError extends Error {
  constructor(readonly variantId: string) { super("INSUFFICIENT_STOCK"); }
}

/** Reserve stock for one order line. Caller holds the variant row lock. */
export async function reserveVariantStock(connection: PoolConnection, input: {
  accountId: string; orderId: string; reference: string; variantId: string; quantity: number; actorUserId?: string | null; notes: string;
}) {
  const [result] = await connection.execute<ResultSetHeader>(
    "UPDATE commerce_product_variants SET stock_quantity=stock_quantity-?,stock_reserved=stock_reserved+? WHERE id=? AND account_id=? AND stock_quantity>=?",
    [input.quantity, input.quantity, input.variantId, input.accountId, input.quantity],
  );
  if (result.affectedRows !== 1) throw new InsufficientStockError(input.variantId);
  await connection.execute(
    "INSERT INTO commerce_stock_movements(id,account_id,variant_id,order_id,movement_type,quantity,reserved_delta,reference,notes,created_by) VALUES(?,?,?,?,'reservation',?,?,?,?,?)",
    [randomUUID(), input.accountId, input.variantId, input.orderId, -input.quantity, input.quantity, input.reference, input.notes, input.actorUserId ?? null],
  );
}

/**
 * Release (cancellation) or consume (shipment) an order's reservation.
 * Idempotent: does nothing unless the order currently holds a reservation.
 * Must run inside the transaction that locked the order row.
 */
export async function settleOrderStock(connection: PoolConnection, input: {
  accountId: string; orderId: string; effect: StockEffect; actorUserId: string | null; reference: string;
}) {
  const [orders] = await connection.execute<(RowDataPacket & { stock_state: string })[]>(
    "SELECT stock_state FROM commerce_orders WHERE id=? AND account_id=? FOR UPDATE", [input.orderId, input.accountId],
  );
  if (orders[0]?.stock_state !== "reserved") return false;

  const [held] = await connection.execute<(RowDataPacket & { variant_id: string; reserved: string | number })[]>(
    `SELECT variant_id, SUM(reserved_delta) AS reserved FROM commerce_stock_movements
      WHERE order_id=? AND account_id=? AND variant_id IS NOT NULL GROUP BY variant_id HAVING SUM(reserved_delta) > 0 ORDER BY variant_id`,
    [input.orderId, input.accountId],
  );
  for (const row of held) {
    const quantity = Number(row.reserved);
    await connection.execute("SELECT id FROM commerce_product_variants WHERE id=? FOR UPDATE", [row.variant_id]);
    if (input.effect === "release") {
      await connection.execute(
        "UPDATE commerce_product_variants SET stock_quantity=stock_quantity+?,stock_reserved=GREATEST(stock_reserved-?,0) WHERE id=?",
        [quantity, quantity, row.variant_id],
      );
    } else {
      await connection.execute(
        "UPDATE commerce_product_variants SET stock_reserved=GREATEST(stock_reserved-?,0) WHERE id=?",
        [quantity, row.variant_id],
      );
    }
    await connection.execute(
      "INSERT INTO commerce_stock_movements(id,account_id,variant_id,order_id,movement_type,quantity,reserved_delta,reference,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [
        randomUUID(), input.accountId, row.variant_id, input.orderId,
        input.effect === "release" ? "release" : "sale",
        input.effect === "release" ? quantity : 0,
        -quantity, input.reference,
        input.effect === "release" ? "Reserva libertada (encomenda cancelada)" : "Reserva convertida em venda (encomenda expedida)",
        input.actorUserId,
      ],
    );
  }
  await connection.execute("UPDATE commerce_orders SET stock_state=? WHERE id=?", [input.effect === "release" ? "released" : "consumed", input.orderId]);
  return true;
}
