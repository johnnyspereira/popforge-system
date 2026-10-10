import type { Metadata } from "next";
import type { RowDataPacket } from "mysql2";
import {
  PublicStorefront,
  type StoreProduct,
} from "@/components/commerce/public-storefront";
import { selectRows } from "@/lib/mysql/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "POPForge — Custom 3D Creations",
  description:
    "Peças únicas, colecionáveis e impressão 3D personalizada, produzidas em Portugal.",
};

interface ProductRow extends RowDataPacket {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  variant_id: string;
  variant_name: string;
  material: string | null;
  color: string | null;
  product_type: string;
  customizable: number | boolean;
  featured: number | boolean;
  price: string | number;
  compare_at_price: string | number | null;
  stock_quantity: string | number;
}

export default async function StorefrontPage() {
  let products: StoreProduct[] = [];
  try {
    const rows = await selectRows<ProductRow[]>(
      `SELECT p.id, p.name, p.description, p.image_url, p.product_type, p.customizable, p.featured,
              v.id AS variant_id, v.name AS variant_name, v.material, v.color, v.price, v.compare_at_price, v.stock_quantity
         FROM commerce_products p
         JOIN commerce_product_variants v ON v.product_id = p.id
        WHERE p.status = 'active' AND v.active = TRUE
          AND (v.track_stock = FALSE OR v.stock_quantity > 0)
        ORDER BY p.featured DESC, p.created_at DESC
        LIMIT 60`,
    );
    products = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      imageUrl: row.image_url,
      variantId: row.variant_id,
      variantName: row.variant_name,
      material: row.material,
      color: row.color,
      productType: row.product_type,
      customizable: Boolean(row.customizable),
      featured: Boolean(row.featured),
      price: Number(row.price),
      compareAtPrice:
        row.compare_at_price == null ? null : Number(row.compare_at_price),
      stock: Number(row.stock_quantity),
    }));
  } catch {
    products = [];
  }
  return <PublicStorefront products={products} />;
}
