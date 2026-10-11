import "server-only";

import type { RowDataPacket } from "mysql2";
import { selectRows } from "@/lib/mysql/db";
import type { StorefrontCatalog, StorefrontProduct } from "./storefront-types";

type AccountRow = RowDataPacket & { id: string };
type ProductRow = RowDataPacket & {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  dimensions: string | null;
  badge: string | null;
  product_type: StorefrontProduct["productType"];
  customizable: boolean | number;
  featured: boolean | number;
  category_slug: string | null;
  category_name: string | null;
  variant_id: string;
  sku: string;
  variant_name: string;
  material: string | null;
  color: string | null;
  size_label: string | null;
  price: number | string;
  compare_at_price: number | string | null;
  stock_quantity: number | string;
  track_stock: boolean | number;
  media_url: string | null;
};

type CategoryRow = RowDataPacket & {
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
};

export async function resolveStorefrontAccount(host?: string) {
  const configured = process.env.STOREFRONT_ACCOUNT_ID?.trim();
  if (configured) return configured;
  const hostname = host?.split(":")[0]?.toLowerCase();
  if (hostname) {
    const byDomain = await selectRows<AccountRow[]>(
      "SELECT id FROM accounts WHERE public_url LIKE ? LIMIT 1",
      [`%${hostname}%`],
    );
    if (byDomain[0]) return byDomain[0].id;
  }
  const accounts = await selectRows<AccountRow[]>(
    "SELECT id FROM accounts ORDER BY created_at ASC LIMIT 2",
  );
  return accounts.length === 1 ? accounts[0].id : null;
}

export async function loadStorefrontCatalog(accountId: string): Promise<StorefrontCatalog> {
  const [rows, categories] = await Promise.all([
    selectRows<ProductRow[]>(
      `SELECT p.id,p.slug,p.name,p.description,p.image_url,p.dimensions,p.badge,p.product_type,p.customizable,p.featured,
              c.slug AS category_slug,c.name AS category_name,
              v.id AS variant_id,v.sku,v.name AS variant_name,v.material,v.color,v.size_label,v.price,v.compare_at_price,v.stock_quantity,v.track_stock,
              m.url AS media_url
         FROM commerce_products p
         LEFT JOIN commerce_categories c ON c.id=p.category_id
         JOIN commerce_product_variants v ON v.product_id=p.id AND v.active=TRUE
         LEFT JOIN commerce_product_media m ON m.product_id=p.id AND m.variant_id IS NULL
        WHERE p.account_id=? AND p.status='active'
          AND (v.track_stock=FALSE OR v.stock_quantity>0)
        ORDER BY p.featured DESC,p.created_at DESC,m.sort_order ASC`,
      [accountId],
    ),
    selectRows<CategoryRow[]>(
      `SELECT c.slug,c.name,c.description,
              (SELECT p.image_url FROM commerce_products p WHERE p.category_id=c.id AND p.status='active' ORDER BY p.featured DESC,p.created_at DESC LIMIT 1) AS image_url
         FROM commerce_categories c WHERE c.account_id=? AND c.active=TRUE ORDER BY c.sort_order,c.name`,
      [accountId],
    ),
  ]);
  const products = new Map<string, StorefrontProduct>();
  for (const row of rows) {
    let product = products.get(row.id);
    if (!product) {
      product = {
        id: row.id, slug: row.slug, name: row.name, description: row.description,
        imageUrl: row.image_url, images: [], dimensions: row.dimensions, badge: row.badge,
        productType: row.product_type, customizable: Boolean(row.customizable), featured: Boolean(row.featured),
        category: row.category_slug && row.category_name ? { slug: row.category_slug, name: row.category_name } : null,
        variants: [],
      };
      products.set(row.id, product);
    }
    if (row.media_url && !product.images.includes(row.media_url)) product.images.push(row.media_url);
    if (!product.variants.some((variant) => variant.id === row.variant_id)) product.variants.push({
      id: row.variant_id, sku: row.sku, name: row.variant_name, material: row.material, color: row.color,
      sizeLabel: row.size_label, price: Number(row.price),
      compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price),
      stock: Number(row.stock_quantity), trackStock: Boolean(row.track_stock),
    });
  }
  for (const product of products.values()) if (product.imageUrl && !product.images.includes(product.imageUrl)) product.images.unshift(product.imageUrl);
  return { products: [...products.values()], categories: categories.map((category) => ({ slug: category.slug, name: category.name, description: category.description, imageUrl: category.image_url })) };
}

export async function loadStorefrontProduct(accountId: string, slug: string) {
  const catalog = await loadStorefrontCatalog(accountId);
  return catalog.products.find((product) => product.slug === slug) ?? null;
}
