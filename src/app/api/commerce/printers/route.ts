import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { getSession } from '@/lib/auth/session';
import { getAuthContext } from '@/lib/auth/service';
import { hasMinRole } from '@/lib/auth/roles';
import { selectRows, mutate } from '@/lib/mysql/db';

const clean = (value: unknown, limit: number) => String(value ?? '').trim().slice(0, limit);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function authContext() { const session = await getSession(); return session ? getAuthContext(session.user.id) : null; }

export async function GET() {
  const auth = await authContext();
  if (!auth) return Response.json({ error: 'Sessão inválida.' }, { status: 401 });
  const printers = await selectRows<RowDataPacket[]>(`SELECT id,name,model,nozzle_diameter,local_address,connection_mode,status,current_file,progress_percent,nozzle_temperature,bed_temperature,last_error,last_seen_at,notes,created_at FROM commerce_printers WHERE account_id=? ORDER BY created_at DESC`, [auth.account.id]);
  return Response.json({ printers });
}

export async function POST(request: Request) {
  const auth = await authContext();
  if (!auth) return Response.json({ error: 'Sessão inválida.' }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, 'agent')) return Response.json({ error: 'Sem permissão para gerir impressoras.' }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = clean(body?.name, 120); const localAddress = clean(body?.localAddress, 255);
  if (!name) return Response.json({ error: 'Indique o nome da impressora.' }, { status: 400 });
  const connectionMode = body?.connectionMode === 'local_worker' ? 'local_worker' : 'manual';
  const workerKey = connectionMode === 'local_worker' ? randomBytes(32).toString('base64url') : null;
  const id = randomUUID();
  await mutate(`INSERT INTO commerce_printers(id,account_id,name,model,nozzle_diameter,local_address,connection_mode,worker_key_hash,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?)`, [id, auth.account.id, name, clean(body?.model, 160) || null, Number(body?.nozzleDiameter) || null, localAddress || null, connectionMode, workerKey ? hash(workerKey) : null, 'offline', clean(body?.notes, 2000) || null]);
  return Response.json({ success: true, id, workerKey });
}

export async function PATCH(request: Request) {
  const auth = await authContext();
  if (!auth) return Response.json({ error: 'Sessão inválida.' }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, 'agent')) return Response.json({ error: 'Sem permissão para gerir impressoras.' }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = clean(body?.id, 36);
  if (id && body?.action === 'update') {
    const name = clean(body?.name, 120);
    if (!name) return Response.json({ error: 'Indique o nome da impressora.' }, { status: 400 });
    const result = await mutate(
      'UPDATE commerce_printers SET name=?,model=?,nozzle_diameter=?,local_address=?,notes=? WHERE id=? AND account_id=?',
      [name, clean(body?.model, 160) || null, Number(body?.nozzleDiameter) || null, clean(body?.localAddress, 255) || null, clean(body?.notes, 2000) || null, id, auth.account.id],
    );
    if (!result.affectedRows) return Response.json({ error: 'Impressora não encontrada.' }, { status: 404 });
    return Response.json({ success: true, id });
  }
  if (!id || body?.action !== 'rotate_worker_key') return Response.json({ error: 'Pedido inválido.' }, { status: 400 });
  const workerKey = randomBytes(32).toString('base64url');
  const result = await mutate('UPDATE commerce_printers SET worker_key_hash=?, connection_mode=\'local_worker\' WHERE id=? AND account_id=?', [hash(workerKey), id, auth.account.id]);
  if (!result.affectedRows) return Response.json({ error: 'Impressora não encontrada.' }, { status: 404 });
  return Response.json({ success: true, id, workerKey });
}
