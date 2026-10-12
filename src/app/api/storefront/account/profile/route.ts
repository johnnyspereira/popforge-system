import { getCustomerSession } from "@/lib/commerce/customer-session";
import { mutate } from "@/lib/mysql/db";

const clean = (value: unknown, limit: number) => String(value ?? "").trim().slice(0, limit);

export async function PATCH(request: Request) {
  const session = await getCustomerSession();
  if (!session) return Response.json({ error: "Sessão de cliente inválida." }, { status: 401 });
  const body = await request.json().catch(() => null) as { name?: unknown; phone?: unknown } | null;
  const name = clean(body?.name, 180);
  const phone = clean(body?.phone, 40).replace(/[^+\d]/g, "");
  if (!name || phone.length < 7) return Response.json({ error: "Indique o nome e um telefone válido." }, { status: 400 });
  await mutate("UPDATE contacts SET name=?,phone=? WHERE id=? AND account_id=?", [name, phone, session.contactId, session.accountId]);
  return Response.json({ success: true, customer: { name, phone } });
}
