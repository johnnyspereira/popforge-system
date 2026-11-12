import { randomUUID } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

/** Reconciles the order with every production job, including kit components. */
export async function syncProductionOrder(connection: PoolConnection, orderId: string, actorUserId?: string | null) {
  const [orders] = await connection.execute<(RowDataPacket & { status: string; account_id: string; order_number: number })[]>(
    'SELECT status,account_id,order_number FROM commerce_orders WHERE id=? FOR UPDATE', [orderId],
  );
  const order = orders[0];
  if (!order) return null;
  const [jobs] = await connection.execute<(RowDataPacket & { status: string })[]>(
    'SELECT status FROM commerce_production_jobs WHERE order_id=?', [orderId],
  );
  if (!jobs.length) return null;
  const allComplete = jobs.every((job) => job.status === 'completed');
  const hasActive = jobs.some((job) => ['printing', 'preparing', 'post_processing', 'quality_check'].includes(job.status));
  const next = allComplete ? 'quality_check' : hasActive ? 'in_production' : null;
  if (!next || next === order.status || ['shipped', 'delivered', 'cancelled'].includes(order.status)) return null;
  await connection.execute('UPDATE commerce_orders SET status=? WHERE id=?', [next, orderId]);
  await connection.execute(
    'INSERT INTO commerce_order_history(id,account_id,order_id,actor_user_id,event_type,previous_value,new_value,notes,metadata) VALUES(?,?,?,?,?,?,?,?,?)',
    [randomUUID(), order.account_id, orderId, actorUserId || null, 'production_sync', order.status, next,
      allComplete ? 'Todas as peças da encomenda foram concluídas; aguarda controlo de qualidade.' : 'A produção da encomenda foi iniciada.',
      JSON.stringify({ jobs: jobs.length, completed: jobs.filter((job) => job.status === 'completed').length })],
  );
  return { accountId: order.account_id, orderNumber: order.order_number, previous: order.status, next };
}
