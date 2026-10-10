'use client';

import { useState } from 'react';
import { ArrowRight, Box, Check, ShoppingBag, Sparkles } from 'lucide-react';

export type StoreProduct = { id: string; name: string; description: string | null; variantId: string; price: number; stock: number };

export function PublicStorefront({ products }: { products: StoreProduct[] }) {
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [message, setMessage] = useState('');
  async function order(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/storefront/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variantId: selected.variantId, name: form.get('name'), email: form.get('email'), phone: form.get('phone'), quantity: Number(form.get('quantity')) }) });
    const result = await response.json() as { orderNumber?: number; error?: string };
    setMessage(response.ok ? `Pedido #${result.orderNumber} recebido. Entraremos em contacto consigo.` : result.error || 'Não foi possível enviar o pedido.');
    if (response.ok) setSelected(null);
  }
  return <div className="min-h-screen bg-[#061015] text-white">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6"><div className="text-xl font-black tracking-tight"><span className="text-cyan-300">POP</span>FORGE</div><a href="/login" className="text-sm text-slate-300 hover:text-white">Área de gestão</a></header>
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.2fr_.8fr] lg:py-24"><div><p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200"><Sparkles className="size-3.5" /> Criado camada a camada em Portugal</p><h1 className="max-w-4xl text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl">Ideias que ganham <span className="text-cyan-300">forma.</span></h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Peças únicas, colecionáveis e impressão 3D personalizada. Escolha um produto ou peça um orçamento à medida.</p><a href="#produtos" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950">Ver produtos <ArrowRight className="size-4" /></a></div><div className="flex min-h-72 items-center justify-center rounded-[2rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,.25),transparent_55%)]"><Box className="size-32 text-cyan-300" strokeWidth={1} /></div></section>
      <section id="produtos" className="mx-auto max-w-7xl px-6 py-16"><div className="mb-8"><p className="text-sm font-bold text-cyan-300">CATÁLOGO</p><h2 className="mt-2 text-3xl font-bold">Produzido pela POPForge</h2></div>{products.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-slate-300">A primeira coleção está a ser preparada. Volte em breve.</div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map(product => <article key={product.variantId} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"><div className="flex h-52 items-center justify-center bg-[radial-gradient(circle,rgba(34,211,238,.18),transparent_65%)]"><Box className="size-20 text-cyan-300" strokeWidth={1.2} /></div><div className="p-5"><h3 className="text-xl font-bold">{product.name}</h3><p className="mt-2 min-h-12 text-sm text-slate-400">{product.description || 'Produção 3D cuidada e acabamento de qualidade.'}</p><div className="mt-5 flex items-center justify-between"><strong className="text-xl">{product.price.toFixed(2).replace('.', ',')} €</strong><button onClick={() => { setSelected(product); setMessage(''); }} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950"><ShoppingBag className="mr-2 inline size-4" />Pedir</button></div></div></article>)}</div>}</section>
      <section className="mx-auto max-w-7xl px-6 pb-20"><div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-8 sm:grid-cols-3">{['Produção local', 'Personalização disponível', 'Acompanhamento da encomenda'].map(item => <div key={item} className="flex items-center gap-3"><span className="rounded-full bg-cyan-300/15 p-2 text-cyan-300"><Check className="size-4" /></span>{item}</div>)}</div></section>
    </main>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><form onSubmit={order} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 text-slate-950"><h2 className="text-xl font-bold">Pedir {selected.name}</h2><input name="name" required placeholder="Nome" className="h-11 w-full rounded-lg border px-3" /><input name="email" type="email" required placeholder="E-mail" className="h-11 w-full rounded-lg border px-3" /><input name="phone" type="tel" required placeholder="Telefone / WhatsApp" className="h-11 w-full rounded-lg border px-3" /><input name="quantity" type="number" min="1" defaultValue="1" className="h-11 w-full rounded-lg border px-3" /><div className="flex gap-3"><button type="button" onClick={() => setSelected(null)} className="flex-1 rounded-lg border px-4 py-2">Cancelar</button><button className="flex-1 rounded-lg bg-cyan-400 px-4 py-2 font-bold">Enviar pedido</button></div></form></div>}
    {message && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 shadow-xl">{message}</div>}
  </div>;
}
