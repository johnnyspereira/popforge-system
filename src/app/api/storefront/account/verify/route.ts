import { createHash } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { establishCustomerSession } from "@/lib/commerce/customer-session";
import { clientIp } from "@/lib/commerce/storefront-contact";
import { transaction } from "@/lib/mysql/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// Step 2 of portal access. POST (not GET) so email link scanners that
// prefetch URLs cannot burn the one-time token.
export async function POST(request: Request) {
  const limit = checkRateLimit(`portal-verify:${clientIp(request)}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!limit.success) return rateLimitResponse(limit);
  const body = await request.json().catch(() => null) as { token?: string } | null;
  const token = String(body?.token ?? "").trim();
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return Response.json({ error: "Link de acesso inválido." }, { status: 400 });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const owner = await transaction(async (connection) => {
    const [rows] = await connection.execute<(RowDataPacket & { id: string; account_id: string; contact_id: string })[]>(
      "SELECT id,account_id,contact_id FROM commerce_customer_login_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP(3) LIMIT 1 FOR UPDATE", [tokenHash],
    );
    if (!rows[0]) return null;
    const [used] = await connection.execute<ResultSetHeader>("UPDATE commerce_customer_login_tokens SET used_at=UTC_TIMESTAMP(3) WHERE id=? AND used_at IS NULL", [rows[0].id]);
    return used.affectedRows === 1 ? rows[0] : null;
  });
  if (!owner) return Response.json({ error: "Este link expirou ou já foi utilizado. Peça um novo." }, { status: 410 });
  await establishCustomerSession(owner.account_id, owner.contact_id);
  return Response.json({ success: true });
}
