import { randomUUID } from "node:crypto";
import { resolveStorefrontAccount } from "@/lib/commerce/storefront";
import { publicStorageUrl, saveObject } from "@/lib/storage/local-storage";
import { transaction } from "@/lib/mysql/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { clientIp, resolveStorefrontContact } from "@/lib/commerce/storefront-contact";

const clean = (value: unknown, size: number) => String(value ?? "").trim().slice(0, size);
const allowedExtensions = new Set([".pdf", ".stl", ".obj", ".3mf", ".jpg", ".jpeg", ".png", ".webp"]);
function filePath(accountId: string, name: string) { const extension = /\.[a-z0-9]+$/i.exec(name)?.[0]?.toLowerCase() || ".bin"; const base = name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 48) || "referencia"; return `account-${accountId}/requests/${Date.now()}-${randomUUID()}-${base}${extension}`; }

export async function POST(request: Request) {
  const limit = checkRateLimit(`storefront-request:${clientIp(request)}`, { limit: 5, windowMs: 10 * 60_000 });
  if (!limit.success) return rateLimitResponse(limit);
  const contentType = request.headers.get("content-type") || "";
  const source = contentType.includes("multipart/form-data") ? await request.formData() : await request.json().catch(() => null) as Record<string, unknown> | null;
  const value = (key: string) => source instanceof FormData ? source.get(key) : source?.[key];
  const name = clean(value("name"), 180), email = clean(value("email"), 320).toLowerCase(), description = clean(value("description"), 8000);
  if (!name || !email.includes("@") || !description) return Response.json({ error: "Preencha nome, e-mail e descrição do pedido." }, { status: 400 });
  const accountId = await resolveStorefrontAccount(new URL(request.url).host);
  if (!accountId) return Response.json({ error: "A loja não está configurada." }, { status: 503 });
  const files = source instanceof FormData ? source.getAll("files").filter((file): file is File => file instanceof File && file.size > 0) : [];
  if (files.length > 5 || files.some((file) => file.size > 10 * 1024 * 1024 || !allowedExtensions.has(/\.[a-z0-9]+$/i.exec(file.name)?.[0]?.toLowerCase() || ""))) return Response.json({ error: "Pode anexar até 5 ficheiros PDF, STL, OBJ, 3MF ou imagens, com máximo de 10 MB cada." }, { status: 400 });
  try {
    const attachments: Array<{ name: string; url: string; type: string; size: number }> = [];
    for (const file of files) { const path = filePath(accountId, file.name); await saveObject("commerce-requests", path, new Uint8Array(await file.arrayBuffer())); attachments.push({ name: file.name.slice(0, 180), url: publicStorageUrl("commerce-requests", path), type: file.type, size: file.size }); }
    await transaction(async (connection) => {
      const phone = clean(value("phone"), 40).replace(/[^+\d]/g, "");
      const contact = await resolveStorefrontContact(connection, { accountId, ownerUserId: null, name, email, phone, create: false });
      await connection.execute("INSERT INTO commerce_custom_requests(id,account_id,contact_id,request_type,customer_name,customer_email,customer_phone,company_name,description,dimensions,color,material,quantity,desired_date,attachments) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [randomUUID(), accountId, contact?.contactId ?? null, clean(value("type"), 10) === "b2b" ? "b2b" : "custom", name, email, phone || null, clean(value("company"), 180) || null, description, clean(value("dimensions"), 240) || null, clean(value("color"), 100) || null, clean(value("material"), 100) || null, Math.max(1, Math.min(99999, Number(value("quantity")) || 1)), clean(value("desiredDate"), 10) || null, JSON.stringify(attachments)]);
    });
    return Response.json({ success: true }, { status: 201 });
  } catch (error) { console.error("[storefront-request]", error); return Response.json({ error: "Não foi possível enviar o pedido." }, { status: 500 }); }
}
