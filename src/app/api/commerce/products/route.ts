import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getSession } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/service";
import { hasMinRole } from "@/lib/auth/roles";
import { selectRows, transaction } from "@/lib/mysql/db";

type ProductRow = RowDataPacket & {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  status: string;
  product_type: string;
  customizable: number;
  featured: number;
  created_at: string;
  variant_id: string;
  sku: string;
  variant_name: string;
  price: string;
  cost_price: string | null;
  stock_quantity: string;
  track_stock: number;
  material: string | null;
  color: string | null;
  weight_grams: string | null;
};

function clean(value: unknown, max = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}
function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function friendlyError(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  const message = error instanceof Error ? error.message : "";
  if (code === "ER_DUP_ENTRY" || message.includes("Duplicate entry")) {
    if (message.includes("commerce_variants_sku_unique"))
      return {
        message: "Este SKU já está em uso. Escolha um código diferente.",
        field: "sku",
        status: 409,
      };
    return { message: "Já existe um produto com estes dados.", status: 409 };
  }
  return {
    message: "Não foi possível guardar o produto. Tente novamente.",
    status: 500,
  };
}

async function context() {
  const session = await getSession();
  if (!session) return null;
  return getAuthContext(session.user.id);
}

export async function GET() {
  const auth = await context();
  if (!auth)
    return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const products = await selectRows<ProductRow[]>(
    `SELECT p.id,p.name,p.slug,p.description,p.image_url,p.status,p.product_type,p.customizable,p.featured,p.created_at,
            v.id AS variant_id,v.sku,v.name AS variant_name,v.price,v.cost_price,v.stock_quantity,v.track_stock,v.material,v.color,v.weight_grams
       FROM commerce_products p
       JOIN commerce_product_variants v ON v.product_id=p.id AND v.active=TRUE
      WHERE p.account_id=? ORDER BY p.created_at DESC`,
    [auth.account.id],
  );
  return Response.json({ products });
}

export async function POST(request: Request) {
  const auth = await context();
  if (!auth)
    return Response.json({ error: "Sessão inválida." }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, "agent"))
    return Response.json({ error: "Sem permissão para criar produtos." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const name = clean(body?.name, 180);
  const sku = clean(body?.sku, 100).toUpperCase();
  const price = Number(body?.price);
  const stock = Number(body?.stock);
  if (
    !name ||
    !sku ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isFinite(stock) ||
    stock < 0
  )
    return Response.json(
      { error: "Preencha nome, SKU, preço e stock corretamente." },
      { status: 400 },
    );
  const productId = randomUUID();
  const variantId = randomUUID();
  try {
    await transaction(async (connection) => {
      await connection.execute(
        `INSERT INTO commerce_products(id,account_id,name,slug,description,image_url,status,product_type,customizable,featured)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
        [
          productId,
          auth.account.id,
          name,
          `${slugify(name) || "produto"}-${Date.now().toString(36)}`,
          clean(body?.description, 5000) || null,
          clean(body?.imageUrl, 2000) || null,
          clean(body?.status, 20) === "draft" ? "draft" : "active",
          clean(body?.productType, 30) || "ready_made",
          Boolean(body?.customizable),
          Boolean(body?.featured),
        ],
      );
      await connection.execute(
        `INSERT INTO commerce_product_variants(id,account_id,product_id,sku,name,material,color,price,cost_price,weight_grams,stock_quantity,track_stock,active)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,TRUE)`,
        [
          variantId,
          auth.account.id,
          productId,
          sku,
          clean(body?.variantName, 160) || "Padrão",
          clean(body?.material, 80) || null,
          clean(body?.color, 80) || null,
          price,
          Number(body?.costPrice) || null,
          Number(body?.weightGrams) || null,
          stock,
          body?.trackStock !== false,
        ],
      );
    });
    return Response.json({ success: true, id: productId }, { status: 201 });
  } catch (error) {
    const result = friendlyError(error);
    return Response.json(
      { error: result.message, field: result.field },
      { status: result.status },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await context();
  if (!auth)
    return Response.json({ error: "Sessão inválida." }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, "agent"))
    return Response.json({ error: "Sem permissão para editar produtos." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const id = clean(body?.id, 36);
  const variantId = clean(body?.variantId, 36);
  const name = clean(body?.name, 180);
  const sku = clean(body?.sku, 100).toUpperCase();
  if (!id || !variantId || !name || !sku)
    return Response.json({ error: "Produto inválido." }, { status: 400 });
  try {
    await transaction(async (connection) => {
      const [product] = await connection.execute<ResultSetHeader>(
        `UPDATE commerce_products SET name=?,description=?,image_url=?,status=?,product_type=?,customizable=?,featured=? WHERE id=? AND account_id=?`,
        [
          name,
          clean(body?.description, 5000) || null,
          clean(body?.imageUrl, 2000) || null,
          clean(body?.status, 20) === "draft"
            ? "draft"
            : clean(body?.status, 20) === "archived"
              ? "archived"
              : "active",
          clean(body?.productType, 30) || "ready_made",
          Boolean(body?.customizable),
          Boolean(body?.featured),
          id,
          auth.account.id,
        ],
      );
      if (!product.affectedRows) throw new Error("PRODUCT_NOT_FOUND");
      await connection.execute(
        `UPDATE commerce_product_variants SET sku=?,name=?,material=?,color=?,price=?,cost_price=?,weight_grams=?,stock_quantity=?,track_stock=? WHERE id=? AND product_id=? AND account_id=?`,
        [
          sku,
          clean(body?.variantName, 160) || "Padrão",
          clean(body?.material, 80) || null,
          clean(body?.color, 80) || null,
          Number(body?.price) || 0,
          Number(body?.costPrice) || null,
          Number(body?.weightGrams) || null,
          Math.max(0, Number(body?.stock) || 0),
          body?.trackStock !== false,
          variantId,
          id,
          auth.account.id,
        ],
      );
    });
    return Response.json({ success: true });
  } catch (error) {
    const result = friendlyError(error);
    return Response.json(
      { error: result.message, field: result.field },
      { status: result.status },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await context();
  if (!auth)
    return Response.json({ error: "Sessão inválida." }, { status: 401 });
  if (!hasMinRole(auth.profile.account_role, "agent"))
    return Response.json({ error: "Sem permissão para arquivar produtos." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id)
    return Response.json({ error: "Produto inválido." }, { status: 400 });
  await transaction(async (connection) => {
    await connection.execute(
      `UPDATE commerce_products SET status='archived' WHERE id=? AND account_id=?`,
      [id, auth.account.id],
    );
  });
  return Response.json({ success: true });
}
