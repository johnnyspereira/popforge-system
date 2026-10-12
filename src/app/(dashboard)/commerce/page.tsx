import Link from "next/link";
import type { RowDataPacket } from "mysql2";
import {
  ArrowRight,
  Boxes,
  Calculator,
  CircleDollarSign,
  Factory,
  Package,
  ShoppingCart,
  Store,
  Wrench,
} from "lucide-react";
import { getCurrentAccount } from "@/lib/auth/account";
import { selectRows } from "@/lib/mysql/db";

type Stats = RowDataPacket & {
  products: number;
  orders: number;
  production: number;
  low_stock: number;
  pending_requests: number;
  monthly_sales: string | number;
};
const money = (value: string | number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
    Number(value || 0),
  );

export default async function CommercePage() {
  const account = await getCurrentAccount();
  const [stats] = await selectRows<Stats[]>(
    `SELECT
      (SELECT COUNT(*) FROM commerce_products WHERE account_id=? AND status='active') AS products,
      (SELECT COUNT(*) FROM commerce_orders WHERE account_id=? AND status NOT IN ('delivered','cancelled','refunded')) AS orders,
      (SELECT COUNT(*) FROM commerce_production_jobs WHERE account_id=? AND status NOT IN ('completed','failed')) AS production,
      (SELECT COUNT(*) FROM commerce_product_variants v JOIN commerce_products p ON p.id=v.product_id WHERE p.account_id=? AND v.track_stock=TRUE AND v.stock_quantity<=2 AND v.active=TRUE) AS low_stock,
      (SELECT COUNT(*) FROM commerce_custom_requests WHERE account_id=? AND status IN ('new','reviewing')) AS pending_requests,
      (SELECT COALESCE(SUM(total),0) FROM commerce_orders WHERE account_id=? AND payment_status='paid' AND created_at>=DATE_FORMAT(UTC_DATE(),'%Y-%m-01')) AS monthly_sales`,
    Array(6).fill(account.account.id),
  ).catch(() => []);
  const data = stats || {
    products: 0,
    orders: 0,
    production: 0,
    low_stock: 0,
    pending_requests: 0,
    monthly_sales: 0,
  };
  const cards = [
    ["Abrir oficina", "", Wrench, "/commerce/oficina"],
    ["Produtos publicados", data.products, Package, "/commerce/produtos"],
    ["Encomendas a tratar", data.orders, ShoppingCart, "/commerce/encomendas"],
    ["Em produção", data.production, Factory, "/commerce/producao"],
    ["Stock baixo", data.low_stock, Boxes, "/commerce/inventario"],
    ["Financeiro POPForge", "", CircleDollarSign, "/commerce/financeiro"],
  ] as const;
  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <section className="rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_85%_15%,rgba(34,211,238,.15),transparent_30%),linear-gradient(135deg,#071014,#0b1c23)] p-6 text-white sm:p-8">
        <p className="text-xs font-bold tracking-[.18em] text-cyan-300">
          COMÉRCIO POPFORGE
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Operação da loja
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Estes indicadores são calculados diretamente dos produtos, encomendas,
          produção e pedidos recebidos pela loja.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-bold text-slate-950"
            href="/commerce/produtos"
          >
            <Package className="size-4" /> Gerir catálogo
          </Link>
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm"
            href="/"
            target="_blank"
          >
            <Store className="size-4" /> Ver loja
          </Link>
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm"
            href="/commerce/calculadora"
          >
            <Calculator className="size-4" /> Calculadora
          </Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, href]) => (
          <Link
            key={label}
            href={href}
            className="rounded-xl border bg-card p-5 transition hover:border-cyan-500/40 hover:bg-card-2"
          >
            <Icon className="size-5 text-cyan-600" />
            <p className="mt-5 text-3xl font-bold">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </Link>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Vendas recebidas este mês
          </p>
          <p className="mt-2 text-3xl font-bold">{money(data.monthly_sales)}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Só encomendas com pagamento confirmado entram neste total.
          </p>
        </div>
        <Link
          href="/commerce/encomendas"
          className="rounded-xl border bg-card p-6 transition hover:border-cyan-500/40"
        >
          <p className="text-sm text-muted-foreground">
            Pedidos personalizados e B2B pendentes
          </p>
          <p className="mt-2 text-3xl font-bold">{data.pending_requests}</p>
          <span className="mt-3 inline-flex items-center text-sm font-semibold text-cyan-600">
            Abrir encomendas <ArrowRight className="ml-1 size-4" />
          </span>
        </Link>
      </section>
    </div>
  );
}
