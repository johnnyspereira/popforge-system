import "server-only";

import { randomUUID } from "node:crypto";
import type { ExecuteValues } from "mysql2";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import catalog from "@/data/lovable-catalog.json";

type CatalogProduct = (typeof catalog.products)[number];

const allColors = [
  "Azul elétrico", "Vermelho", "Amarelo", "Verde", "Laranja", "Roxo", "Rosa",
  "Preto", "Off-white", "Grafite", "Bege", "Azul", "Verde-água", "Castanho", "Mesclado/Multicolor",
];

function skuPart(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();
}

async function findId(connection: PoolConnection, sql: string, values: ExecuteValues[]) {
  const [rows] = await connection.execute<(RowDataPacket & { id: string })[]>(sql, values);
  return rows[0]?.id ?? null;
}

async function upsertCategory(connection: PoolConnection, accountId: string, category: (typeof catalog.categories)[number], order: number) {
  const existing = await findId(connection, "SELECT id FROM commerce_categories WHERE account_id=? AND slug=? LIMIT 1", [accountId, category.slug]);
  const id = existing || randomUUID();
  if (existing) await connection.execute("UPDATE commerce_categories SET name=?,sort_order=?,active=TRUE WHERE id=?", [category.name, order, id]);
  else await connection.execute("INSERT INTO commerce_categories(id,account_id,name,slug,active,sort_order) VALUES(?,?,?,?,TRUE,?)", [id, accountId, category.name, category.slug, order]);
  return id;
}

export async function importLovableCatalog(connection: PoolConnection, accountId: string) {
  const categories = new Map<string, string>();
  for (const [order, category] of catalog.categories.entries()) categories.set(category.slug, await upsertCategory(connection, accountId, category, order));

  let importedProducts = 0;
  let importedVariants = 0;
  for (const source of catalog.products as CatalogProduct[]) {
    const categoryId = categories.get(source.category) || null;
    const existingId = await findId(connection, "SELECT id FROM commerce_products WHERE account_id=? AND slug=? LIMIT 1", [accountId, source.slug]);
    const productId = existingId || randomUUID();
    const productType = source.from || source.stock === "Por encomenda" ? "made_to_order" : "ready_made";
    const featured = source.badge === "Mais vendido" || source.id <= 4;
    if (existingId) await connection.execute(
      `UPDATE commerce_products SET category_id=?,name=?,description=?,image_url=?,dimensions=?,badge=?,status='active',product_type=?,customizable=?,featured=?,source_reference='lovable-2026' WHERE id=?`,
      [categoryId, source.name, source.description, source.image, source.dimensions, source.badge, productType, Boolean(source.personalizable), featured, productId],
    );
    else await connection.execute(
      `INSERT INTO commerce_products(id,account_id,category_id,name,slug,description,image_url,dimensions,badge,status,product_type,customizable,featured,source_reference)
       VALUES(?,?,?,?,?,?,?,?,?,'active',?,?,?,'lovable-2026')`,
      [productId, accountId, categoryId, source.name, source.slug, source.description, source.image, source.dimensions, source.badge, productType, Boolean(source.personalizable), featured],
    );
    importedProducts += 1;

    const gallery = Array.from(new Set(source.gallery || [source.image]));
    for (const [position, url] of gallery.entries()) {
      const mediaId = await findId(connection, "SELECT id FROM commerce_product_media WHERE product_id=? AND url=? LIMIT 1", [productId, url]);
      if (!mediaId) await connection.execute("INSERT INTO commerce_product_media(id,account_id,product_id,url,alt_text,sort_order) VALUES(?,?,?,?,?,?)", [randomUUID(), accountId, productId, url, source.name, position]);
    }

    const sizes = source.sizes?.length ? source.sizes : [{ label: "Padrão", delta: 0 }];
    const colors = source.colors?.length ? source.colors : allColors;
    for (const size of sizes) for (const color of colors) {
      const sku = `${skuPart(source.slug)}-${skuPart(size.label)}-${skuPart(color)}`.slice(0, 100);
      const price = Number(source.price) + Number(size.delta || 0);
      const variantId = await findId(connection, "SELECT id FROM commerce_product_variants WHERE account_id=? AND sku=? LIMIT 1", [accountId, sku]) || randomUUID();
      const name = `${size.label} · ${color}`;
      const stock = source.stock === "Por encomenda" ? 0 : 10;
      const trackStock = source.stock !== "Por encomenda";
      await connection.execute(
        `INSERT INTO commerce_product_variants(id,account_id,product_id,sku,name,material,color,size_label,price,stock_quantity,track_stock,active)
         VALUES(?,?,?,?,?,'PLA',?,?,?, ?, ?,TRUE)
         ON DUPLICATE KEY UPDATE product_id=VALUES(product_id),name=VALUES(name),material=VALUES(material),color=VALUES(color),size_label=VALUES(size_label),price=VALUES(price),active=TRUE`,
        [variantId, accountId, productId, sku, name, color, size.label, price, stock, trackStock],
      );
      importedVariants += 1;
    }
  }
  return { products: importedProducts, variants: importedVariants, categories: categories.size };
}
