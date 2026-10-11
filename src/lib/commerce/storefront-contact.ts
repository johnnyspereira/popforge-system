import "server-only";

import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { decideContactMatch, normalizeEmail, type ContactCandidate } from "./customer-match";

type CandidateRow = RowDataPacket & ContactCandidate;

export type StorefrontContactResult =
  | { contactId: string; reviewRequired: false; created: boolean }
  | { contactId: null; reviewRequired: true; conflictContactId: string };

/**
 * Resolve the CRM contact for a storefront customer without overwriting CRM
 * data. `create: false` only links (used by quote requests).
 */
export async function resolveStorefrontContact(connection: PoolConnection, input: {
  accountId: string; ownerUserId: string | null; name: string; email: string; phone: string; create: boolean;
}): Promise<StorefrontContactResult | null> {
  const email = normalizeEmail(input.email);
  const [byEmailRows] = await connection.execute<CandidateRow[]>(
    "SELECT id,name,email,phone FROM contacts WHERE account_id=? AND LOWER(email)=? ORDER BY created_at LIMIT 1 FOR UPDATE",
    [input.accountId, email],
  );
  const [byPhoneRows] = input.phone
    ? await connection.execute<CandidateRow[]>("SELECT id,name,email,phone FROM contacts WHERE account_id=? AND phone=? LIMIT 1 FOR UPDATE", [input.accountId, input.phone])
    : [[] as CandidateRow[]];
  const decision = decideContactMatch(byEmailRows[0] ?? null, byPhoneRows[0] ?? null);

  if (decision.action === "link") {
    if (decision.fillName) await connection.execute("UPDATE contacts SET name=? WHERE id=? AND (name IS NULL OR name='')", [input.name, decision.contactId]);
    return { contactId: decision.contactId, reviewRequired: false, created: false };
  }
  if (decision.action === "review") return { contactId: null, reviewRequired: true, conflictContactId: decision.conflictContactId };
  if (!input.create || !input.ownerUserId || !input.phone) return null;

  const contactId = randomUUID();
  await connection.execute(
    "INSERT INTO contacts(id,account_id,user_id,phone,name,email,source,preferred_contact,marketing_consent,whatsapp_consent) VALUES(?,?,?,?,?,?,'Loja online','email',FALSE,FALSE)",
    [contactId, input.accountId, input.ownerUserId, input.phone, input.name, email],
  );
  return { contactId, reviewRequired: false, created: true };
}

/** Best-effort client IP for per-visitor rate limits behind the cPanel proxy. */
export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
}
