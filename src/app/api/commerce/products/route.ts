import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
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
  production_minutes: string | null;
  production_grams: string | null;
  production_material_sku: string | null;
  production_printer_name: string | null;
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
  const normalized = message.toLowerCase();
  if (code === "ER_NO_SUCH_TABLE" || normalized.includes("commerce_product_kit_components")) {
    return { message: "A base de dados ainda não tem a migração de KIT. Atualize o runtime do cPanel e reinicie a aplicação antes de criar kits.", status: 503 };
  }
  if (code === "ER_BAD_FIELD_ERROR" || normalized.includes("data truncated") || normalized.includes("incorrect value")) {
    return { message: "A estrutura de produtos está desatualizada para este tipo de produto. Execute as migrações do POPForge e tente novamente.", status: 503 };
  }
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
type KitComponent = { variantId: string; quantity: number };
function productType(value: unknown) {
  const type = clean(value, 30);
  return ["ready_made", "made_to_order", "custom_quote", "kit", "pack"].includes(type) ? type : "ready_made";
}
function kitComponents(value: unknown): KitComponent[] {
  if (!Array.isArray(value)) return [];
  const components = value.map((item) => {
    const row = item as Record<string, unknown>;
    return { variantId: clean(row.variantId, 36), quantity: Math.max(1, Math.min(999, Math.floor(Number(row.quantity)) || 1)) };
  }).filter((item) => item.variantId);
  return Array.from(new Map(components.map((item) => [item.variantId, item])).values());
}
async function replaceKitComponents(connection: PoolConnection, accountId: string, kitVariantId: string, components: KitComponent[]) {
  if (components.some((component) => component.variantId === kitVariantId)) throw new Error("KIT_CANNOT_CONTAIN_ITSELF");
  if (components.length) {
    const placeholders = components.map(() => "?").join(",");
    const [variants] = await connection.execute<RowDataPacket[]>(`SELECT id FROM commerce_product_variants WHERE account_id=? AND id IN (${placeholders}) AND active=TRUE`, [accountId, ...components.map((component) => component.variantId)]);
    if (variants.length !== components.length) throw new Error("KIT_COMPONENT_INVALID");
  }
  await connection.execute("DELETE FROM commerce_product_kit_components WHERE account_id=? AND kit_variant_id=?", [accountId, kitVariantId]);
  for (const [index, component] of components.entries()) await connection.execute("INSERT INTO commerce_product_kit_components(id,account_id,kit_variant_id,component_variant_id,quantity,sort_order) VALUES(?,?,?,?,?,?)", [randomUUID(), accountId, kitVariantId, component.variantId, component.quantity, index]);
}

export async function GET() {
  const auth = await context();
  if (!auth)
    return Response.json({ error: "Sessão inválida." }, { status: 401 });
  const products = await selectRows<ProductRow[]>(
    `SELECT p.id,p.name,p.slug,p.description,p.image_url,p.status,p.product_type,p.customizable,p.featured,p.created_at,
            v.id AS variant_id,v.sku,v.name AS variant_name,v.price,v.cost_price,v.stock_quantity,v.track_stock,v.material,v.color,v.weight_grams,v.production_minutes,v.production_grams,v.production_material_sku,v.production_printer_name
       FROM commerce_products p
       JOIN commerce_product_variants v ON v.product_id=p.id AND v.active=TRUE
      WHERE p.account_id=? ORDER BY p.created_at DESC`,
    [auth.account.id],
  );
  // Deployments can briefly run before the kit migration is applied. Product
  // management remains available in that interval; components appear once
  // MySQL has applied migration 064 on the next application start.
  const components = await selectRows<(RowDataPacket & { kit_variant_id: string; component_variant_id: string; quantity: number })[]>(
    "SELECT kit_variant_id,component_variant_id,quantity FROM commerce_product_kit_components WHERE account_id=? ORDER BY sort_order,created_at",
    [auth.account.id],
  ).catch(() => []);
  const byKit = new Map<string, Array<{ variantId: string; quantity: number }>>();
  for (const component of components) byKit.set(component.kit_variant_id, [...(byKit.get(component.kit_variant_id) || []), { variantId: component.component_variant_id, quantity: Number(component.quantity) }]);
  return Response.json({ products: products.map((product) => ({ ...product, kitComponents: byKit.get(product.variant_id) || [] })) });
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
  if (productType(body?.productType) === "kit" && !kitComponents(body?.kitComponents).length)
    return Response.json({ error: "Adicione pelo menos uma peça ao kit." }, { status: 400 });
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
          productType(body?.productType),
          Boolean(body?.customizable),
          Boolean(body?.featured),
        ],
      );
      await connection.execute(
        `INSERT INTO commerce_product_variants(id,account_id,product_id,sku,name,material,color,price,cost_price,weight_grams,production_minutes,production_grams,production_material_sku,production_printer_name,stock_quantity,track_stock,active)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,TRUE)`,
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
          Number(body?.productionMinutes) || null,
          Number(body?.productionGrams) || null,
          clean(body?.productionMaterialSku, 100).toUpperCase() || null,
          clean(body?.productionPrinterName, 120) || null,
          stock,
          body?.trackStock !== false,
        ],
      );
      if (productType(body?.productType) === "kit") await replaceKitComponents(connection, auth.account.id, variantId, kitComponents(body?.kitComponents));
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
          productType(body?.productType),
          Boolean(body?.customizable),
          Boolean(body?.featured),
          id,
          auth.account.id,
        ],
      );
      if (!product.affectedRows) throw new Error("PRODUCT_NOT_FOUND");
      await connection.execute(
        `UPDATE commerce_product_variants SET sku=?,name=?,material=?,color=?,price=?,cost_price=?,weight_grams=?,production_minutes=?,production_grams=?,production_material_sku=?,production_printer_name=?,stock_quantity=?,track_stock=? WHERE id=? AND product_id=? AND account_id=?`,
        [
          sku,
          clean(body?.variantName, 160) || "Padrão",
          clean(body?.material, 80) || null,
          clean(body?.color, 80) || null,
          Number(body?.price) || 0,
          Number(body?.costPrice) || null,
          Number(body?.weightGrams) || null,
          Number(body?.productionMinutes) || null,
          Number(body?.productionGrams) || null,
          clean(body?.productionMaterialSku, 100).toUpperCase() || null,
          clean(body?.productionPrinterName, 120) || null,
          Math.max(0, Number(body?.stock) || 0),
          body?.trackStock !== false,
          variantId,
          id,
          auth.account.id,
        ],
      );
      // A non-kit product must remain editable even when the optional KIT
      // migration has not yet been applied in a deployment.
      if (productType(body?.productType) === "kit") await replaceKitComponents(connection, auth.account.id, variantId, kitComponents(body?.kitComponents));
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
  const url = new URL(request.url);
  const ids = Array.from(new Set([...(url.searchParams.getAll("id")), ...(url.searchParams.get("ids") || "").split(",")].map((value) => clean(value, 36)).filter(Boolean))).slice(0, 200);
  if (!ids.length)
    return Response.json({ error: "Produto inválido." }, { status: 400 });
  await transaction(async (connection) => {
    const placeholders = ids.map(() => "?").join(",");
    await connection.execute(`UPDATE commerce_products SET status='archived' WHERE id IN (${placeholders}) AND account_id=?`, [...ids, auth.account.id]);
  });
  return Response.json({ success: true, archived: ids.length });
}
