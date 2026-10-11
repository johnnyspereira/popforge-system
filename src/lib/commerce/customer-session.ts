import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { mutate, selectRows } from "@/lib/mysql/db";

const COOKIE = "popforge_customer_session";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export type CustomerSession = { accountId: string; contactId: string; email: string; name: string | null };

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await selectRows<(RowDataPacket & { account_id: string; contact_id: string; email: string; name: string | null })[]>(
    `SELECT s.account_id,s.contact_id,c.email,c.name FROM commerce_customer_sessions s JOIN contacts c ON c.id=s.contact_id
      WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3) LIMIT 1`, [hash(token)],
  );
  const row = rows[0];
  if (!row) return null;
  await mutate("UPDATE commerce_customer_sessions SET last_seen_at=UTC_TIMESTAMP(3) WHERE token_hash=?", [hash(token)]);
  return { accountId: row.account_id, contactId: row.contact_id, email: row.email || "", name: row.name };
}

export async function establishCustomerSession(accountId: string, contactId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  await mutate("INSERT INTO commerce_customer_sessions(id,account_id,contact_id,token_hash,expires_at) VALUES(?,?,?,?,?)", [randomUUID(), accountId, contactId, hash(token), expires]);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function clearCustomerSession() {
  const store = await cookies(); const token = store.get(COOKIE)?.value;
  if (token) await mutate("DELETE FROM commerce_customer_sessions WHERE token_hash=?", [hash(token)]);
  store.delete(COOKIE);
}
