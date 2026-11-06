'use client';
import Link from 'next/link';
import { ArrowUpRight, Briefcase, Boxes, CalendarPlus, ClipboardList, PackagePlus, Radio, ShoppingCart, UserPlus, Zap } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const actions = [
  { href: '/agenda?new=1', label: 'Nova marcação', hint: 'Agenda', icon: CalendarPlus },
  { href: '/finance', label: 'Nova venda', hint: 'Financeiro', icon: ShoppingCart },
  { href: '/contacts', label: 'Novo contacto', hint: 'Clientes', icon: UserPlus },
  { href: '/pipelines', label: 'Novo negócio', hint: 'Pipeline', icon: Briefcase },
  { href: '/broadcasts/new', label: 'Nova campanha', hint: 'Comunicação', icon: Radio },
  { href: '/automations/new', label: 'Nova automação', hint: 'Automação', icon: Zap },
  { href: '/commerce/produtos', label: 'Adicionar produto', hint: 'Catálogo e variantes', icon: PackagePlus },
  { href: '/commerce/encomendas', label: 'Ver encomendas', hint: 'Pedidos e estados', icon: ClipboardList },
  { href: '/commerce/inventario', label: 'Controlar stock', hint: 'Entradas e alertas', icon: Boxes },
] as const;

export function QuickActions() {
  return <section className="rounded-3xl border border-border/80 bg-card/80 p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Atalhos operacionais</p><p className="text-xs text-muted-foreground">As tarefas mais frequentes, sempre à mão.</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">POPForge</span></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{actions.map(({ href, label, hint, icon: Icon }) => <Link key={href} href={href} className={cn(buttonVariants({ variant: 'outline' }), 'group h-auto justify-between rounded-2xl px-3.5 py-3 text-left')}><span className="flex min-w-0 items-center gap-3"><span className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-medium">{label}</span><span className="block truncate text-xs text-muted-foreground">{hint}</span></span></span><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}</div></section>;
}
