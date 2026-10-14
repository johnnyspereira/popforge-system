import { createHash } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { mutate, selectRows } from '@/lib/mysql/db';

const clean = (value: unknown, limit: number) => String(value ?? '').trim().slice(0, limit);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;

export async function POST(request: Request) {
  const key = request.headers.get('x-popforge-printer-key') || '';
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const printerId = clean(body?.printerId, 36);
  if (!key || !printerId) return Response.json({ error: 'Credenciais de telemetria inválidas.' }, { status: 401 });
  const rows = await selectRows<(RowDataPacket & { worker_key_hash: string | null })[]>('SELECT worker_key_hash FROM commerce_printers WHERE id=? LIMIT 1', [printerId]);
  if (!rows[0]?.worker_key_hash || hash(key) !== rows[0].worker_key_hash) return Response.json({ error: 'Credenciais de telemetria inválidas.' }, { status: 401 });
  const status = ['offline','idle','printing','paused','error'].includes(clean(body?.status, 16)) ? clean(body?.status, 16) : 'offline';
  const currentFile = clean(body?.currentFile, 255) || null;
  const progress = num(body?.progressPercent);
  await mutate('UPDATE commerce_printers SET status=?,current_file=?,progress_percent=?,nozzle_temperature=?,bed_temperature=?,last_error=?,last_seen_at=UTC_TIMESTAMP(3) WHERE id=?', [status, currentFile, progress, num(body?.nozzleTemperature), num(body?.bedTemperature), clean(body?.lastError, 2000) || null, printerId]);
  const jobs = await selectRows<(RowDataPacket & { id: string; status: string })[]>("SELECT id,status FROM commerce_production_jobs WHERE printer_id=? AND status IN ('queued','preparing','printing','post_processing','quality_check') ORDER BY CASE status WHEN 'printing' THEN 0 WHEN 'preparing' THEN 1 ELSE 2 END, created_at ASC LIMIT 1", [printerId]);
  const job = jobs[0];
  if (job) {
    const nextStatus = status === 'printing' ? 'printing' : status === 'error' ? 'failed' : status === 'idle' && job.status === 'printing' ? 'post_processing' : null;
    await mutate("UPDATE commerce_production_jobs SET printer_file=?,printer_progress_percent=?,printer_last_seen_at=UTC_TIMESTAMP(3),status=COALESCE(?,status),started_at=CASE WHEN ?='printing' AND started_at IS NULL THEN UTC_TIMESTAMP(3) ELSE started_at END,completed_at=CASE WHEN ?='failed' THEN UTC_TIMESTAMP(3) ELSE completed_at END WHERE id=?", [currentFile, progress, nextStatus, nextStatus, nextStatus, job.id]);
  }
  return Response.json({ success: true });
}
