import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { getSession } from '@/lib/auth/session';
import { getAuthContext } from '@/lib/auth/service';
import { hasMinRole } from '@/lib/auth/roles';
import { mutate, selectRows } from '@/lib/mysql/db';
import { loadObject, saveObject } from '@/lib/storage/local-storage';

export const runtime = 'nodejs';

const allowedExtensions = new Set(['.gcode', '.g', '.3mf', '.stl', '.obj', '.pdf', '.zip']);
const extension = (name: string) => /\.[a-z0-9]+$/i.exec(name)?.[0]?.toLowerCase() || '';
const clean = (value: unknown, limit: number) => String(value ?? '').trim().slice(0, limit);
const pathFor = (accountId: string, jobId: string, fileName: string) => {
  const ext = extension(fileName) || '.bin';
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80) || 'producao';
  return `account-${accountId}/production/${jobId}/${Date.now()}-${randomUUID()}-${base}${ext}`;
};

async function authContext() { const session = await getSession(); return session ? getAuthContext(session.user.id) : null; }

export async function POST(request: Request) {
  const auth = await authContext();
  if (!auth) return Response.json({ error: 'Sessão inválida.' }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, 'agent')) return Response.json({ error: 'Sem permissão para anexar ficheiros de produção.' }, { status: 403 });
  const form = await request.formData();
  const jobId = clean(form.get('jobId'), 36); const file = form.get('file');
  if (!jobId || !(file instanceof File)) return Response.json({ error: 'Selecione o trabalho e o ficheiro.' }, { status: 400 });
  if (!file.size || file.size > 50 * 1024 * 1024 || !allowedExtensions.has(extension(file.name))) return Response.json({ error: 'Anexe G-code, 3MF, STL, OBJ, PDF ou ZIP até 50 MB.' }, { status: 400 });
  const job = await selectRows<(RowDataPacket & { id: string })[]>('SELECT id FROM commerce_production_jobs WHERE id=? AND account_id=? LIMIT 1', [jobId, auth.account.id]);
  if (!job[0]) return Response.json({ error: 'Trabalho de produção não encontrado.' }, { status: 404 });
  const storagePath = pathFor(auth.account.id, jobId, file.name);
  await saveObject('commerce-production-files', storagePath, new Uint8Array(await file.arrayBuffer()));
  const id = randomUUID();
  await mutate('INSERT INTO commerce_production_files(id,account_id,production_job_id,original_name,storage_path,mime_type,byte_size,uploaded_by_user_id) VALUES(?,?,?,?,?,?,?,?)', [id, auth.account.id, jobId, clean(file.name, 255), storagePath, clean(file.type, 160) || null, file.size, auth.user.id]);
  return Response.json({ success: true, file: { id, name: clean(file.name, 255), size: file.size } });
}

export async function GET(request: Request) {
  const auth = await authContext();
  if (!auth) return Response.json({ error: 'Sessão inválida.' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return Response.json({ error: 'Ficheiro inválido.' }, { status: 400 });
  const files = await selectRows<(RowDataPacket & { original_name: string; storage_path: string; mime_type: string | null })[]>('SELECT original_name,storage_path,mime_type FROM commerce_production_files WHERE id=? AND account_id=? LIMIT 1', [id, auth.account.id]);
  const file = files[0];
  if (!file) return Response.json({ error: 'Ficheiro não encontrado.' }, { status: 404 });
  const body = await loadObject('commerce-production-files', file.storage_path);
  return new Response(body, { headers: { 'content-type': file.mime_type || 'application/octet-stream', 'content-disposition': `attachment; filename="${file.original_name.replace(/["\\]/g, '_')}"`, 'cache-control': 'private, no-store' } });
}
