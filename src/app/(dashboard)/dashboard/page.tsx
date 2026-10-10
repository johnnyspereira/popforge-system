'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Boxes, CircleDollarSign, Factory, PackageSearch, RefreshCw, ShoppingBag, Store, TriangleAlert } from 'lucide-react';
import { createMysqlBrowserClient } from '@/lib/mysql/browser-client';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Order = { id: string; order_number: string | null; customer_name: string | null; status: string; total: number | string; created_at: string };
type Product = { id: string; status: string };
type Variant = { id: string; stock_quantity: number | string; track_stock: boolean | number };
type Inventory = { id: string; name: string; remaining_quantity: number | string; low_stock_threshold: number | string; unit: string };
type Job = { id: string; status: string };
const db = createMysqlBrowserClient();
const paid = new Set(['paid', 'in_production', 'quality_check', 'ready_to_ship', 'shipped', 'delivered']);
const labels: Record<string, string> = { pending_payment: 'A aguardar pagamento', paid: 'Pago', in_production: 'Em produção', quality_check: 'Controlo de qualidade', ready_to_ship: 'Pronto para envio', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' };
const euros = (value: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const results = await Promise.all([
      db.from<Order[]>('commerce_orders').select('id,order_number,customer_name,status,total,created_at').order('created_at', { ascending: false }).limit(100),
      db.from<Product[]>('commerce_products').select('id,status').limit(500),
      db.from<Variant[]>('commerce_product_variants').select('id,stock_quantity,track_stock').limit(1000),
      db.from<Inventory[]>('commerce_inventory_items').select('id,name,remaining_quantity,low_stock_threshold,unit').eq('active', true).limit(500),
      db.from<Job[]>('commerce_production_jobs').select('id,status').limit(500),
    ]);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) setError(firstError.message);
    setOrders(Array.isArray(results[0].data) ? results[0].data : []);
    setProducts(Array.isArray(results[1].data) ? results[1].data : []);
    setVariants(Array.isArray(results[2].data) ? results[2].data : []);
    setInventory(Array.isArray(results[3].data) ? results[3].data : []);
    setJobs(Array.isArray(results[4].data) ? results[4].data : []);
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const metrics = useMemo(() => {
    const lowStock = inventory.filter((item) => Number(item.remaining_quantity) <= Number(item.low_stock_threshold));
    return {
      ordersToday: orders.filter((order) => order.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
      revenue: orders.filter((order) => paid.has(order.status)).reduce((sum, order) => sum + Number(order.total || 0), 0),
      products: products.filter((product) => product.status === 'active').length,
      lowStock,
      stockAlerts: lowStock.length + variants.filter((variant) => Boolean(variant.track_stock) && Number(variant.stock_quantity) <= 0).length,
      queue: jobs.filter((job) => !['completed', 'cancelled'].includes(job.status)).length,
    };
  }, [inventory, jobs, orders, products, variants]);
  const cards = [
    ['Encomendas hoje', metrics.ordersToday, ShoppingBag, '/commerce/encomendas'],
    ['Vendas registadas', euros(metrics.revenue), CircleDollarSign, '/commerce/encomendas'],
    ['Produtos ativos', metrics.products, Boxes, '/commerce/produtos'],
    ['Alertas de stock', metrics.stockAlerts, TriangleAlert, '/commerce/inventario'],
    ['Fila de produção', metrics.queue, Factory, '/commerce/producao'],
  ] as const;

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.22),_transparent_38%),linear-gradient(135deg,#050b12,#0b2730)] p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-6"><div className="max-w-3xl"><p className="text-xs font-bold tracking-[0.18em] text-cyan-300 uppercase">POPForge Commerce OS</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Centro de comando e-commerce</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Controle catálogo, encomendas, pagamentos, stock, produção 3D e expedição numa única operação.</p></div><div className="flex flex-wrap gap-2"><Link href="/commerce/produtos" className={buttonVariants({ className: 'bg-cyan-400 text-slate-950 hover:bg-cyan-300' })}>Novo produto</Link><Link href="/" target="_blank" className={buttonVariants({ variant: 'outline', className: 'border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white' })}><Store className="size-4" />Abrir loja</Link></div></div>
    </section>
    {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">Não foi possível atualizar o painel: {error}</p> : null}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value, Icon, href]) => <Link key={label} href={href}><Card className="h-full transition hover:-translate-y-0.5 hover:border-cyan-500/40 hover:shadow-md"><CardContent className="p-5"><div className="flex items-center justify-between"><span className="rounded-xl bg-cyan-500/10 p-2 text-cyan-600"><Icon className="size-5" /></span><ArrowRight className="size-4 text-muted-foreground" /></div><p className="mt-5 text-2xl font-bold">{loading ? '—' : value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card></Link>)}</section>
    <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Encomendas recentes</CardTitle><Link href="/commerce/encomendas" className={buttonVariants({ size: 'sm', variant: 'ghost' })}>Ver todas</Link></CardHeader><CardContent className="space-y-3">{!loading && orders.length === 0 ? <div className="py-10 text-center"><PackageSearch className="mx-auto size-9 text-muted-foreground" /><p className="mt-3 font-medium">Ainda não existem encomendas</p><p className="text-sm text-muted-foreground">As compras feitas na loja pública aparecerão aqui.</p></div> : orders.slice(0, 7).map((order) => <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate font-semibold">#{order.order_number || order.id.slice(0, 8)} · {order.customer_name || 'Cliente'}</p><p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString('pt-PT')}</p></div><div className="text-right"><p className="font-semibold">{euros(Number(order.total || 0))}</p><Badge variant="secondary">{labels[order.status] || order.status}</Badge></div></div>)}</CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Stock a exigir atenção</CardTitle><Button type="button" size="icon" variant="ghost" onClick={() => void load()} aria-label="Atualizar"><RefreshCw className="size-4" /></Button></CardHeader><CardContent className="space-y-3">{!loading && metrics.lowStock.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhum material abaixo do stock mínimo.</p> : metrics.lowStock.slice(0, 8).map((item) => <Link href="/commerce/inventario" key={item.id} className="flex items-center justify-between rounded-xl border p-3 hover:bg-muted/40"><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">Mínimo: {Number(item.low_stock_threshold)} {item.unit}</p></div><Badge variant="destructive">{Number(item.remaining_quantity)} {item.unit}</Badge></Link>)}</CardContent></Card>
    </section>
  </div>;
}
