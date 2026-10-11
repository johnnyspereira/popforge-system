export type StorefrontVariant = {
  id: string;
  sku: string;
  name: string;
  material: string | null;
  color: string | null;
  sizeLabel: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  trackStock: boolean;
};

export type StorefrontProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  images: string[];
  category: { slug: string; name: string } | null;
  dimensions: string | null;
  badge: string | null;
  productType: "ready_made" | "made_to_order" | "custom_quote";
  customizable: boolean;
  featured: boolean;
  variants: StorefrontVariant[];
};

export type StorefrontCategory = {
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
};

export type StorefrontCatalog = {
  products: StorefrontProduct[];
  categories: StorefrontCategory[];
};
