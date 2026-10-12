import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { clearCustomerSession, getCustomerSession } from "@/lib/commerce/customer-session";
import { clientIp } from "@/lib/commerce/storefront-contact";
import { emailDeliveryConfiguration, sendLocalEmail } from "@/lib/email/smtp";
import { brandedEmail } from "@/lib/email/templates";
import { mutate, selectRows } from "@/lib/mysql/db";
import { getPublicUrl } from "@/lib/public-url";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const SENT = { success: true, message: "Se os dados estiverem corretos, enviámos um link de acesso para o seu e-mail. O link é válido durante 20 minutos." };

export async function GET() {
  const session = await getCustomerSession();
  if (!session) return Response.json({ authenticated: false }, { status: 401 });
  return Response.json({ authenticated: true, customer: { name: session.name, email: session.email } });
}

// Step 1 of portal access. An e-mail alone never authenticates a customer:
// we only email a one-time link to that address. An order number is useful for
// quicker matching but optional, so quote-only customers can use the account.
export async function POST(request: Request) {
  const ip = clientIp(request);
  const ipLimit = checkRateLimit(`portal-link:${ip}`, { limit: 5, windowMs: 15 * 60_000 });
  if (!ipLimit.success) return rateLimitResponse(ipLimit);
  const body = await request.json().catch(() => null) as { email?: string; orderNumber?: string | number } | null;
  const email = clean(body?.email, 320).toLowerCase();
  const rawOrderNumber = clean(body?.orderNumber, 24);
  const orderNumber = rawOrderNumber ? Number(rawOrderNumber) : null;
  if (!email.includes("@") || (rawOrderNumber && (!Number.isSafeInteger(orderNumber) || (orderNumber ?? 0) < 1))) return Response.json({ error: "Indique um e-mail válido e, se preencher, um número de encomenda válido." }, { status: 400 });
  if (!checkRateLimit(`portal-link-email:${email}`, { limit: 3, windowMs: 60 * 60_000 }).success) return Response.json(SENT);
  if (!emailDeliveryConfiguration().ready) return Response.json({ error: "O acesso por e-mail ainda não está disponível. Contacte-nos para saber o estado da encomenda." }, { status: 503 });

  const rows = orderNumber
    ? await selectRows<(RowDataPacket & { account_id: string; contact_id: string; name: string | null })[]>(
      `SELECT o.account_id,o.contact_id,c.name FROM commerce_orders o JOIN contacts c ON c.id=o.contact_id
        WHERE o.order_number=? AND LOWER(o.customer_email)=? AND LOWER(c.email)=? LIMIT 1`, [orderNumber, email, email],
    )
    : await selectRows<(RowDataPacket & { account_id: string; contact_id: string; name: string | null })[]>(
      `SELECT c.account_id,c.id AS contact_id,c.name FROM contacts c
       WHERE LOWER(c.email)=? AND (
         EXISTS(SELECT 1 FROM commerce_orders o WHERE o.account_id=c.account_id AND o.contact_id=c.id)
         OR EXISTS(SELECT 1 FROM commerce_custom_requests r WHERE r.account_id=c.account_id AND r.contact_id=c.id)
         OR EXISTS(SELECT 1 FROM commerce_quotes q WHERE q.account_id=c.account_id AND q.contact_id=c.id)
       ) ORDER BY c.created_at DESC LIMIT 1`, [email],
    );
  const match = rows[0];
  if (match) {
    const token = randomBytes(32).toString("base64url");
    await mutate(
      "INSERT INTO commerce_customer_login_tokens(id,account_id,contact_id,token_hash,expires_at) VALUES(?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 20 MINUTE))",
      [randomUUID(), match.account_id, match.contact_id, createHash("sha256").update(token).digest("hex")],
    );
    const url = new URL(getPublicUrl("/minha-conta", new URL(request.url).origin));
    url.searchParams.set("acesso", token);
    const html = brandedEmail({
      businessName: "POPForge", preheader: "O seu link de acesso às encomendas POPForge.", eyebrow: "Acesso seguro",
      title: "Aceda às suas encomendas", greeting: `Olá${match.name ? `, ${match.name}` : ""}.`,
      message: "Recebemos um pedido para abrir a sua conta POPForge. Use o botão abaixo nos próximos 20 minutos. O link só funciona uma vez.",
      action: { label: "Abrir a minha conta", url: url.toString() },
      notice: "Se não fez este pedido, ignore esta mensagem. Ninguém consegue entrar sem este link.",
    });
    try {
      await sendLocalEmail({ to: email, profile: "general", subject: "O seu acesso POPForge", text: `Abra a sua conta POPForge (válido 20 minutos): ${url.toString()}`, html });
    } catch (cause) {
      console.error("[storefront-portal-link]", cause);
    }
  }
  return Response.json(SENT);
}

export async function DELETE() { await clearCustomerSession(); return Response.json({ success: true }); }
