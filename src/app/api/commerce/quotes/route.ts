import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/service";
import { hasMinRole } from "@/lib/auth/roles";
import { selectRows, transaction } from "@/lib/mysql/db";

async function context() { const session = await getSession(); return session ? getAuthContext(session.user.id) : null; }
const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export async function GET() {
  const auth = await context(); if (!auth) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const [requests, quotes] = await Promise.all([
    selectRows<RowDataPacket[]>("SELECT id,request_type,status,customer_name,customer_email,customer_phone,company_name,description,dimensions,color,material,quantity,desired_date,attachments,created_at FROM commerce_custom_requests WHERE account_id=? ORDER BY created_at DESC LIMIT 200", [auth.account.id]),
    selectRows<RowDataPacket[]>("SELECT q.id,q.quote_number,q.status,q.total,q.valid_until,q.notes,q.request_id,q.order_id,q.created_at,c.name AS customer_name,c.email AS customer_email FROM commerce_quotes q LEFT JOIN contacts c ON c.id=q.contact_id WHERE q.account_id=? ORDER BY q.created_at DESC LIMIT 200", [auth.account.id]),
  ]);
  return Response.json({ requests, quotes });
}

export async function POST(request: Request) {
  const auth = await context(); if (!auth) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, "agent")) return Response.json({ error: "Sem permissão para criar orçamentos." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const requestId = clean(body?.requestId, 36); const title = clean(body?.title, 180); const total = Number(body?.total);
  if (!requestId || !title || !Number.isFinite(total) || total < 0) return Response.json({ error: "Preencha pedido, descrição e valor do orçamento." }, { status: 400 });
  try {
    const result = await transaction(async (connection) => {
      const [requests] = await connection.execute<(RowDataPacket & { contact_id: string | null })[]>("SELECT contact_id FROM commerce_custom_requests WHERE id=? AND account_id=? FOR UPDATE", [requestId, auth.account.id]);
      if (!requests[0]) throw new Error("REQUEST_NOT_FOUND");
      const quoteId = randomUUID();
      const [quote] = await connection.execute<ResultSetHeader>("INSERT INTO commerce_quotes(id,account_id,contact_id,request_id,status,currency,subtotal,total,valid_until,notes,line_items) VALUES(?,?,?,?, 'draft','EUR',?,?,?, ?,?)", [quoteId, auth.account.id, requests[0].contact_id, requestId, total, total, clean(body?.validUntil, 10) || null, clean(body?.notes, 5000) || null, JSON.stringify([{ description: title, quantity: 1, unit_price: total, total }])]);
      await connection.execute("UPDATE commerce_custom_requests SET status='quoted' WHERE id=?", [requestId]);
      return { id: quoteId, number: quote.insertId };
    });
    return Response.json({ success: true, ...result }, { status: 201 });
  } catch (error) { if (error instanceof Error && error.message === "REQUEST_NOT_FOUND") return Response.json({ error: "Pedido não encontrado." }, { status: 404 }); console.error("[commerce-quote-create]", error); return Response.json({ error: "Não foi possível criar o orçamento." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const auth = await context(); if (!auth) return Response.json({ error: "Sessão inválida." }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, "agent")) return Response.json({ error: "Sem permissão para gerir orçamentos." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: string; status?: string; action?: string } | null;
  if (!body?.id) return Response.json({ error: "Orçamento inválido." }, { status: 400 });
  const quoteId = body.id;
  try {
    if (body.action === "convert") {
      const result = await transaction(async (connection) => {
        type Quote = RowDataPacket & { id: string; quote_number: number; contact_id: string | null; request_id: string | null; total: string | number; line_items: string | unknown[]; notes: string | null; status: string; order_id: string | null; customer_name: string | null; customer_email: string | null; customer_phone: string | null };
        const [quotes] = await connection.execute<Quote[]>("SELECT q.*,r.customer_name,r.customer_email,r.customer_phone FROM commerce_quotes q LEFT JOIN commerce_custom_requests r ON r.id=q.request_id WHERE q.id=? AND q.account_id=? FOR UPDATE", [quoteId, auth.account.id]);
        const quote = quotes[0]; if (!quote) throw new Error("NOT_FOUND");
        if (quote.order_id) return { orderId: quote.order_id, existing: true };
        if (quote.status !== "accepted") throw new Error("NOT_ACCEPTED");
        const entries = Array.isArray(quote.line_items) ? quote.line_items : JSON.parse(String(quote.line_items || "[]"));
        if (!Array.isArray(entries) || entries.length === 0) throw new Error("NO_ITEMS");
        const orderId = randomUUID();
        await connection.execute("INSERT INTO commerce_orders(id,account_id,contact_id,status,payment_status,channel,currency,subtotal,total,customer_name,customer_email,customer_phone,notes) VALUES(?,?,?,'pending_payment','pending','custom_quote','EUR',?,?,?,?,?,?)", [orderId, auth.account.id, quote.contact_id, quote.total, quote.total, quote.customer_name, quote.customer_email, quote.customer_phone, quote.notes]);
        for (const entry of entries as Array<Record<string, unknown>>) { const quantity = Math.max(1, Math.floor(Number(entry.quantity) || 1)); const unitPrice = Math.max(0, Number(entry.unit_price) || 0); await connection.execute("INSERT INTO commerce_order_items(id,account_id,order_id,product_name,quantity,unit_price,line_total,customization) VALUES(?,?,?,?,?,?,?,?)", [randomUUID(), auth.account.id, orderId, clean(entry.description, 180) || "Peça personalizada", quantity, unitPrice, Number(entry.total) || unitPrice * quantity, JSON.stringify({ quote_id: quote.id })]); }
        await connection.execute("UPDATE commerce_quotes SET status='converted',order_id=? WHERE id=?", [orderId, quote.id]);
        if (quote.request_id) await connection.execute("UPDATE commerce_custom_requests SET status='converted' WHERE id=?", [quote.request_id]);
        await connection.execute("INSERT INTO commerce_order_history(id,account_id,order_id,actor_user_id,event_type,new_value,notes) VALUES(?,?,?,?,?,?,?)", [randomUUID(), auth.account.id, orderId, auth.user.id, "quote_converted", "pending_payment", `Criada a partir do orçamento #${quote.quote_number}`]);
        return { orderId, existing: false };
      });
      return Response.json({ success: true, ...result });
    }
    const status = body.status; if (!status || !["draft", "sent", "accepted", "rejected", "expired"].includes(status)) return Response.json({ error: "Estado de orçamento inválido." }, { status: 400 });
    const [updated] = await transaction(async (connection) => connection.execute<ResultSetHeader>("UPDATE commerce_quotes SET status=? WHERE id=? AND account_id=? AND status<>'converted'", [status, quoteId, auth.account.id]));
    if (!updated.affectedRows) throw new Error("NOT_FOUND");
    return Response.json({ success: true });
  } catch (error) { const message = error instanceof Error ? error.message : ""; if (message === "NOT_FOUND") return Response.json({ error: "Orçamento não encontrado." }, { status: 404 }); if (message === "NOT_ACCEPTED") return Response.json({ error: "Aceite o orçamento antes de o converter em encomenda." }, { status: 400 }); if (message === "NO_ITEMS") return Response.json({ error: "O orçamento não tem linhas para converter." }, { status: 400 }); console.error("[commerce-quote-update]", error); return Response.json({ error: "Não foi possível atualizar o orçamento." }, { status: 500 }); }
}
