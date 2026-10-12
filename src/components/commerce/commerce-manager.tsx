'use client';

import { useCallback, useEffect, useState } from 'react';
import { createMysqlBrowserClient } from '@/lib/mysql/browser-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { nextOrderStatuses, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUSES } from '@/lib/commerce/order-status';

type Kind = 'products' | 'inventory' | 'orders' | 'production';
type Row = Record<string, unknown> & { id: string };
const db = createMysqlBrowserClient();
const config = {
  products: { title: 'Produtos e variantes', table: 'commerce_products', empty: 'Ainda não existem produtos.' },
  inventory: { title: 'Stock e materiais', table: 'commerce_inventory_items', empty: 'Ainda não existem materiais de produção.' },
  orders: { title: 'Encomendas', table: 'commerce_orders', empty: 'As encomendas da loja aparecerão aqui.' },
  production: { title: 'Produção 3D', table: 'commerce_production_jobs', empty: 'Ainda não existem trabalhos de produção.' },
} as const;

export function CommerceManager({ kind }: { kind: Kind }) {
  const [rows, setRows] = useState<Row[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const current = config[kind];
  const load = useCallback(async () => {
    setLoading(true);
    if (kind === 'orders') {
      const response = await fetch('/api/commerce/orders', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { orders?: Row[]; error?: string };
      setError(response.ok ? '' : payload.error || 'Não foi possível carregar as encomendas.'); setRows(payload.orders || []);
    } else {
      const result = await db.from<Row[]>(current.table).select('*').order('created_at', { ascending: false }).limit(200);
      setError(result.error?.message || ''); setRows(Array.isArray(result.data) ? result.data : []);
    }
    setLoading(false);
  }, [current.table, kind]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      if (kind === 'products') {
        const id = crypto.randomUUID(), name = String(form.get('name')).trim();
        const slug = `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
        const product = await db.from('commerce_products').insert({ id, name, slug, description: String(form.get('description') || ''), status: 'active', product_type: 'ready_made', customizable: false, featured: false });
        if (product.error) throw new Error(product.error.message);
        const variant = await db.from('commerce_product_variants').insert({ id: crypto.randomUUID(), product_id: id, sku: String(form.get('sku')).trim(), name: 'Padrão', price: Number(form.get('price')), stock_quantity: Number(form.get('stock')), track_stock: true, active: true });
        if (variant.error) throw new Error(variant.error.message);
      }
      if (kind === 'inventory') {
        const quantity = Number(form.get('quantity'));
        const result = await db.from('commerce_inventory_items').insert({ id: crypto.randomUUID(), sku: String(form.get('sku')).trim(), item_type: String(form.get('type')), name: String(form.get('name')).trim(), material: String(form.get('material') || '').trim() || null, color: String(form.get('color') || '').trim() || null, supplier: String(form.get('supplier') || '').trim() || null, unit: String(form.get('unit')), purchase_total: Number(form.get('cost')), purchased_quantity: quantity, remaining_quantity: quantity, low_stock_threshold: Number(form.get('minimum')), active: true });
        if (result.error) throw new Error(result.error.message);
      }
      formElement.reset(); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível guardar.'); }
  }
  async function updateOrder(row: Row, value: string, field: 'status' | 'paymentStatus') {
    const response = await fetch('/api/commerce/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, [field]: value }) });
    const payload = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) setError(payload.error || 'Não foi possível atualizar a encomenda.'); else await load();
  }
  return <div className="space-y-6 p-4 sm:p-6 lg:p-8"><header><p className="text-sm font-semibold text-cyan-600">POPForge Commerce</p><h1 className="text-3xl font-semibold">{current.title}</h1>{kind === 'inventory' && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Registe filamentos, tintas, pincéis, consumíveis e embalagens por código, referência e fornecedor.</p>}</header>
    {(kind === 'products' || kind === 'inventory') && <Card><CardHeader><CardTitle>{kind === 'products' ? 'Novo produto para a loja' : 'Entrada de material de produção'}</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Nome" name="name" required/><Field label={kind === 'products' ? 'SKU' : 'Código / SKU interno'} name="sku" required/>{kind === 'products' ? <><Field label="Preço (€)" name="price" type="number" min="0" step="0.01" required/><Field label="Stock inicial" name="stock" type="number" min="0" step="1" required/><div className="space-y-2 md:col-span-2 xl:col-span-3"><Label>Descrição</Label><Input name="description"/></div></> : <><Field label="Tipo" name="type" select options={[["filament","Filamento"],["paint","Tinta / acrílico"],["tool","Ferramenta / pincel"],["packaging","Embalagem"],["consumable","Consumível"],["finished_product","Produto acabado"]]}/><Field label="Material" name="material" placeholder="Ex.: PLA, PETG, verniz"/><Field label="Cor / referência" name="color" placeholder="Ex.: AZ-041"/><Field label="Fornecedor" name="supplier" placeholder="Opcional"/><Field label="Unidade" name="unit" select options={[["gram","Grama"],["unit","Unidade"],["milliliter","Mililitro"],["meter","Metro"]]}/><Field label="Quantidade recebida" name="quantity" type="number" min="0" step="0.001" required/><Field label="Custo total (€)" name="cost" type="number" min="0" step="0.01" required/><Field label="Stock mínimo" name="minimum" type="number" min="0" step="0.001" defaultValue="0"/></>}<div className="flex items-end"><Button className="w-full" type="submit">Guardar</Button></div></form></CardContent></Card>}
    {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}
    <Card><CardContent className="pt-6">{loading ? <p>A carregar…</p> : rows.length === 0 ? <p className="py-10 text-center text-muted-foreground">{current.empty}</p> : <div className="space-y-3">{rows.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><p className="font-semibold">{String(row.name || row.product_name || `Encomenda #${row.order_number || ''}` || 'Trabalho')}</p><p className="text-sm text-muted-foreground">{[row.sku,row.material,row.color,row.supplier].filter(Boolean).map(String).join(' · ') || String(row.customer_email || row.printer_name || '')}</p></div><div className="flex items-center gap-2">{kind !== 'orders' && <Badge variant="secondary">{String(row.status || row.item_type || 'ativo')}</Badge>}{kind === 'orders' && <><select aria-label="Estado da encomenda" value="" onChange={event => { if (event.target.value) void updateOrder(row,event.target.value,'status'); }} className="h-8 rounded-lg border bg-background px-2 text-sm"><option value="">{ORDER_STATUS_LABELS[String(row.status) as keyof typeof ORDER_STATUS_LABELS] || String(row.status)}</option>{nextOrderStatuses(String(row.status)).map(status => <option key={status} value={status}>→ {ORDER_STATUS_LABELS[status]}</option>)}</select><select aria-label="Estado do pagamento" value={String(row.payment_status)} onChange={event => void updateOrder(row,event.target.value,'paymentStatus')} className="h-8 rounded-lg border bg-background px-2 text-sm">{PAYMENT_STATUSES.map(status => <option key={status} value={status}>Pagamento: {PAYMENT_STATUS_LABELS[status]}</option>)}</select></>}</div></div>)}</div>}</CardContent></Card></div>;
}

function Field({ label, name, select, options, ...props }: { label: string; name: string; select?: boolean; options?: string[][]; required?: boolean; type?: string; min?: string; step?: string; defaultValue?: string; placeholder?: string }) { return <div className="space-y-2"><Label>{label}</Label>{select ? <select name={name} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">{options?.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select> : <Input name={name} {...props}/>}</div>; }
