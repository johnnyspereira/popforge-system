'use client';

import { useCallback, useEffect, useState } from 'react';
import { createMysqlBrowserClient } from '@/lib/mysql/browser-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type Kind = 'products' | 'inventory' | 'orders' | 'production';
type Row = Record<string, unknown> & { id: string };
const db = createMysqlBrowserClient();

const config = {
  products: { title: 'Produtos e variantes', table: 'commerce_products', empty: 'Ainda não existem produtos.' },
  inventory: { title: 'Inventário', table: 'commerce_inventory_items', empty: 'Ainda não existem materiais ou embalagens.' },
  orders: { title: 'Encomendas', table: 'commerce_orders', empty: 'As encomendas da loja aparecerão aqui.' },
  production: { title: 'Produção 3D', table: 'commerce_production_jobs', empty: 'Ainda não existem trabalhos de produção.' },
} as const;

export function CommerceManager({ kind }: { kind: Kind }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const current = config[kind];

  const load = useCallback(async () => {
    setLoading(true);
    const result = await db.from<Row[]>(current.table).select('*').order('created_at', { ascending: false }).limit(200);
    setError(result.error?.message || '');
    setRows(Array.isArray(result.data) ? result.data : []);
    setLoading(false);
  }, [current.table]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createProduct(form: FormData) {
    const productId = crypto.randomUUID();
    const name = String(form.get('name') || '').trim();
    const slug = `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
    const product = await db.from('commerce_products').insert({ id: productId, name, slug, description: String(form.get('description') || ''), status: 'active', product_type: 'ready_made', customizable: false, featured: false });
    if (product.error) throw new Error(product.error.message);
    const variant = await db.from('commerce_product_variants').insert({ id: crypto.randomUUID(), product_id: productId, sku: String(form.get('sku')), name: 'Padrão', price: Number(form.get('price')), stock_quantity: Number(form.get('stock')), track_stock: true, active: true });
    if (variant.error) throw new Error(variant.error.message);
  }

  async function createInventory(form: FormData) {
    const quantity = Number(form.get('quantity'));
    const result = await db.from('commerce_inventory_items').insert({ id: crypto.randomUUID(), sku: String(form.get('sku')), item_type: String(form.get('type')), name: String(form.get('name')), unit: String(form.get('unit')), purchase_total: Number(form.get('cost')), purchased_quantity: quantity, remaining_quantity: quantity, low_stock_threshold: Number(form.get('minimum')), active: true });
    if (result.error) throw new Error(result.error.message);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    try { const form = new FormData(event.currentTarget); if (kind === 'products') await createProduct(form); else if (kind === 'inventory') await createInventory(form); event.currentTarget.reset(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível guardar.'); }
  }

  async function updateStatus(row: Row, status: string) {
    const result = await db.from(current.table).update({ status }).eq('id', row.id);
    if (result.error) { setError(result.error.message); return; }
    if (kind === 'orders' && status === 'in_production') {
      const items = await db.from<Row[]>('commerce_order_items').select('*').eq('order_id', row.id);
      if (Array.isArray(items.data)) {
        for (const item of items.data) {
          const existing = await db.from<Row[]>('commerce_production_jobs').select('id').eq('order_item_id', item.id).limit(1);
          if (!Array.isArray(existing.data) || existing.data.length === 0) {
            await db.from('commerce_production_jobs').insert({ id: crypto.randomUUID(), order_item_id: item.id, status: 'queued' });
          }
        }
      }
    }
    await load();
  }

  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <header><p className="text-sm font-semibold text-cyan-600">POPForge Commerce</p><h1 className="text-3xl font-semibold">{current.title}</h1></header>
    {(kind === 'products' || kind === 'inventory') && <Card><CardHeader><CardTitle>{kind === 'products' ? 'Novo produto' : 'Novo item de stock'}</CardTitle></CardHeader><CardContent>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2"><Label>Nome</Label><Input name="name" required /></div>
        <div className="space-y-2"><Label>SKU</Label><Input name="sku" required /></div>
        {kind === 'products' ? <><div className="space-y-2"><Label>Preço (€)</Label><Input name="price" type="number" min="0" step="0.01" required /></div><div className="space-y-2"><Label>Stock</Label><Input name="stock" type="number" min="0" step="1" required /></div><div className="space-y-2 md:col-span-2 xl:col-span-3"><Label>Descrição</Label><Input name="description" /></div></> : <><div className="space-y-2"><Label>Tipo</Label><select name="type" className="h-8 w-full rounded-lg border bg-background px-2"><option value="filament">Filamento</option><option value="packaging">Embalagem</option><option value="consumable">Consumível</option><option value="finished_product">Produto acabado</option></select></div><div className="space-y-2"><Label>Unidade</Label><select name="unit" className="h-8 w-full rounded-lg border bg-background px-2"><option value="gram">Grama</option><option value="unit">Unidade</option><option value="milliliter">Mililitro</option><option value="meter">Metro</option></select></div><div className="space-y-2"><Label>Quantidade</Label><Input name="quantity" type="number" min="0" step="0.001" required /></div><div className="space-y-2"><Label>Custo total (€)</Label><Input name="cost" type="number" min="0" step="0.01" required /></div><div className="space-y-2"><Label>Stock mínimo</Label><Input name="minimum" type="number" min="0" step="0.001" defaultValue="0" /></div></>}
        <div className="flex items-end"><Button className="w-full" type="submit">Guardar</Button></div>
      </form>
    </CardContent></Card>}
    {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
    <Card><CardContent className="pt-6">{loading ? <p>A carregar…</p> : rows.length === 0 ? <p className="py-10 text-center text-muted-foreground">{current.empty}</p> : <div className="space-y-3">{rows.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><p className="font-semibold">{String(row.name || row.product_name || `Encomenda #${row.order_number || ''}` || 'Trabalho')}</p><p className="text-sm text-muted-foreground">{String(row.sku || row.customer_email || row.printer_name || '')}</p></div><div className="flex items-center gap-2"><Badge variant="secondary">{String(row.status || row.item_type || 'ativo')}</Badge>{kind === 'orders' && <select value={String(row.status)} onChange={e => void updateStatus(row, e.target.value)} className="h-8 rounded-lg border bg-background px-2 text-sm"><option value="pending_payment">A aguardar pagamento</option><option value="paid">Pago</option><option value="in_production">Em produção</option><option value="quality_check">Qualidade</option><option value="ready_to_ship">Pronto para envio</option><option value="shipped">Enviado</option><option value="delivered">Entregue</option><option value="cancelled">Cancelado</option></select>}</div></div>)}</div>}</CardContent></Card>
  </div>;
}
