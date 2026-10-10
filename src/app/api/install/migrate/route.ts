import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { RowDataPacket } from 'mysql2';
import { selectRows } from '@/lib/mysql/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const execFileAsync = promisify(execFile);
interface CountRow extends RowDataPacket { total: number }

export async function POST() {
  try {
    try {
      const users = await selectRows<CountRow[]>('SELECT COUNT(*) AS total FROM app_users');
      if (Number(users[0]?.total || 0) > 0) return Response.json({ error: 'A instalação inicial já foi concluída.' }, { status: 409 });
    } catch {
      // A ausência da tabela é o estado inicial esperado.
    }
    const script = path.join(process.cwd(), 'scripts', 'mysql-migrate.mjs');
    const { stdout } = await execFileAsync(process.execPath, [script], {
      cwd: process.cwd(), env: process.env, timeout: 120_000, maxBuffer: 2 * 1024 * 1024,
    });
    return Response.json({ success: true, output: stdout.trim().split(/\r?\n/).slice(-5) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Falha desconhecida na migration.';
    return Response.json({ error: `Não foi possível criar o esquema MySQL: ${detail}` }, { status: 500 });
  }
}
