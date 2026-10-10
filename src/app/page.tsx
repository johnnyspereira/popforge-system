import type { Metadata } from 'next';
import type { RowDataPacket } from 'mysql2';
import { PublicStorefront, type StoreProduct } from '@/components/commerce/public-storefront';
import { selectRows } from '@/lib/mysql/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'POPForge — Ideias que ganham forma',
  description: 'Peças únicas, colecionáveis e impressão 3D personalizada, produzidas em Portugal.',
};

interface ProductRow extends RowDataPacket {
  id: string;
  name: string;
  description: string | null;
  variant_id: string;
  price: string | number;
  stock_quantity: string | number;
}

export default async function StorefrontPage() {
  let products: StoreProduct[] = [];
  try {
    const rows = await selectRows<ProductRow[]>(
      `SELECT p.id, p.name, p.description, v.id AS variant_id, v.price, v.stock_quantity
         FROM commerce_products p
         JOIN commerce_product_variants v ON v.product_id = p.id
        WHERE p.status = 'active' AND v.active = TRUE
          AND (v.track_stock = FALSE OR v.stock_quantity > 0)
        ORDER BY p.featured DESC, p.created_at DESC
        LIMIT 60`
    );
    products = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      variantId: row.variant_id,
      price: Number(row.price),
      stock: Number(row.stock_quantity),
    }));
  } catch {
    products = [];
  }
  return <PublicStorefront products={products} />;
}
