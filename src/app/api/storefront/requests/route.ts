import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { resolveStorefrontAccount } from "@/lib/commerce/storefront";
import { transaction } from "@/lib/mysql/db";

const clean = (value: unknown, size: number) => String(value ?? "").trim().slice(0, size);
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = clean(body?.name, 180), email = clean(body?.email, 320).toLowerCase(), description = clean(body?.description, 8000);
  if (!name || !email.includes("@") || !description) return Response.json({ error: "Preencha nome, e-mail e descrição do pedido." }, { status: 400 });
  const accountId = await resolveStorefrontAccount(new URL(request.url).host);
  if (!accountId) return Response.json({ error: "A loja não está configurada." }, { status: 503 });
  try {
    await transaction(async (connection) => {
      const phone = clean(body?.phone, 40).replace(/[^+\d]/g, "");
      const [found] = await connection.execute<(RowDataPacket & { id: string })[]>("SELECT id FROM contacts WHERE account_id=? AND (email=? OR phone=?) LIMIT 1", [accountId, email, phone]);
      const contactId = found[0]?.id || null;
      await connection.execute("INSERT INTO commerce_custom_requests(id,account_id,contact_id,request_type,customer_name,customer_email,customer_phone,company_name,description,dimensions,color,material,quantity,desired_date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [randomUUID(), accountId, contactId, clean(body?.type, 10) === "b2b" ? "b2b" : "custom", name, email, phone || null, clean(body?.company, 180) || null, description, clean(body?.dimensions, 240) || null, clean(body?.color, 100) || null, clean(body?.material, 100) || null, Math.max(1, Math.min(99999, Number(body?.quantity) || 1)), clean(body?.desiredDate, 10) || null]);
    });
    return Response.json({ success: true }, { status: 201 });
  } catch (error) { console.error("[storefront-request]", error); return Response.json({ error: "Não foi possível enviar o pedido." }, { status: 500 }); }
}
