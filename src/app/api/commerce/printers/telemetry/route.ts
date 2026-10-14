import { createHash, randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { sendOrderUpdateEmail } from '@/lib/commerce/order-communication';
import { transaction, selectRows } from '@/lib/mysql/db';

const clean = (value: unknown, limit: number) => String(value ?? '').trim().slice(0, limit);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;
const fileName = (value: string | null) => (value || '').replace(/\\/g, '/').split('/').pop()?.toLowerCase() || '';
type CustomerUpdate = { to: string | null; name: string | null; orderNumber: number; value: string };

export async function POST(request: Request) {
  const key = request.headers.get('x-popforge-printer-key') || '';
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const printerId = clean(body?.printerId, 36);
  if (!key || !printerId) return Response.json({ error: 'Credenciais de telemetria inválidas.' }, { status: 401 });
  const rows = await selectRows<(RowDataPacket & { worker_key_hash: string | null })[]>('SELECT worker_key_hash FROM commerce_printers WHERE id=? LIMIT 1', [printerId]);
  if (!rows[0]?.worker_key_hash || hash(key) !== rows[0].worker_key_hash) return Response.json({ error: 'Credenciais de telemetria inválidas.' }, { status: 401 });
  const status = ['offline', 'idle', 'printing', 'paused', 'error'].includes(clean(body?.status, 16)) ? clean(body?.status, 16) : 'offline';
  const currentFile = clean(body?.currentFile, 255) || null; const progress = num(body?.progressPercent); const updates: CustomerUpdate[] = [];
  await transaction(async (connection) => {
    await connection.execute('UPDATE commerce_printers SET status=?,current_file=?,progress_percent=?,nozzle_temperature=?,bed_temperature=?,last_error=?,last_seen_at=UTC_TIMESTAMP(3) WHERE id=?', [status, currentFile, progress, num(body?.nozzleTemperature), num(body?.bedTemperature), clean(body?.lastError, 2000) || null, printerId]);
    const [jobs] = await connection.execute<(RowDataPacket & { id: string; status: string; order_id: string | null; order_number: number | null; customer_email: string | null; customer_name: string | null; order_status: string | null; internal_files: string | null })[]>(`SELECT j.id,j.status,j.order_id,o.order_number,o.customer_email,o.customer_name,o.status AS order_status,GROUP_CONCAT(f.original_name SEPARATOR '|') AS internal_files
      FROM commerce_production_jobs j LEFT JOIN commerce_orders o ON o.id=j.order_id LEFT JOIN commerce_production_files f ON f.production_job_id=j.id
      WHERE j.printer_id=? AND j.status IN ('queued','preparing','printing','post_processing','quality_check')
      GROUP BY j.id ORDER BY CASE j.status WHEN 'printing' THEN 0 WHEN 'preparing' THEN 1 ELSE 2 END,j.created_at ASC`, [printerId]);
    const active = jobs.find(job => job.status === 'printing');
    const currentName = fileName(currentFile);
    const matched = currentName ? jobs.find(job => (job.internal_files || '').split('|').some(name => fileName(name) === currentName)) : undefined;
    // We accept idle/error only for an already-started job. A new print must
    // match a file explicitly attached to the production order.
    const job = active || (status === 'printing' ? matched : undefined);
    if (!job) return;
    const nextJobStatus = status === 'printing' ? 'printing' : status === 'error' ? 'failed' : status === 'idle' && job.status === 'printing' ? 'post_processing' : null;
    await connection.execute("UPDATE commerce_production_jobs SET printer_file=?,printer_progress_percent=?,printer_last_seen_at=UTC_TIMESTAMP(3),status=COALESCE(?,status),started_at=CASE WHEN ?='printing' AND started_at IS NULL THEN UTC_TIMESTAMP(3) ELSE started_at END,completed_at=CASE WHEN ?='failed' THEN UTC_TIMESTAMP(3) ELSE completed_at END WHERE id=?", [currentFile, progress, nextJobStatus, nextJobStatus, nextJobStatus, job.id]);
    const nextOrderStatus = nextJobStatus === 'printing' ? 'in_production' : nextJobStatus === 'post_processing' ? 'quality_check' : null;
    const canUpdateOrder = nextOrderStatus && job.order_id && ((nextOrderStatus === 'in_production' && ['confirmed', 'paid', 'quality_check'].includes(job.order_status || '')) || (nextOrderStatus === 'quality_check' && job.order_status === 'in_production'));
    if (canUpdateOrder && nextOrderStatus) {
      await connection.execute('UPDATE commerce_orders SET status=? WHERE id=?', [nextOrderStatus, job.order_id]);
      await connection.execute('INSERT INTO commerce_order_history(id,account_id,order_id,event_type,previous_value,new_value,notes,metadata) SELECT ?,account_id,?,\'printer_telemetry\',?,?,?,? FROM commerce_orders WHERE id=?', [randomUUID(), job.order_id, job.order_status, nextOrderStatus, nextOrderStatus === 'in_production' ? 'A impressão foi iniciada automaticamente pela impressora atribuída.' : 'A impressão terminou; a encomenda segue para acabamento e controlo de qualidade.', JSON.stringify({ printer_id: printerId, current_file: currentFile, progress_percent: progress }), job.order_id]);
      if (job.order_number) updates.push({ to: job.customer_email, name: job.customer_name, orderNumber: job.order_number, value: nextOrderStatus });
    }
  });
  await Promise.all(updates.map(update => sendOrderUpdateEmail({ ...update, kind: 'status' })));
  return Response.json({ success: true, notified: updates.length > 0 });
}
