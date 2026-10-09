import Link from 'next/link';
import { ArrowRight, Boxes, Calculator, Factory, Package, ShoppingCart, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const modules = [
  { title: 'Produtos e variantes', description: 'Catálogo, categorias, materiais, cores, tamanhos, preços e stock por SKU.', icon: Package },
  { title: 'Encomendas', description: 'Da compra ao envio: pagamento, produção, controlo de qualidade e tracking.', icon: ShoppingCart },
  { title: 'Inventário', description: 'Filamentos, embalagens, consumíveis e produtos acabados com custo unitário.', icon: Boxes },
  { title: 'Produção 3D', description: 'Fila de impressão, impressora, consumo previsto e real, falhas e acabamento.', icon: Factory },
];

export default function CommercePage() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-[radial-gradient(circle_at_85%_20%,rgba(34,211,238,0.15),transparent_32%),linear-gradient(135deg,#071014,#0b1c23)] p-6 text-white shadow-xl sm:p-8">
        <div className="max-w-3xl space-y-4">
          <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-200">POPForge Commerce OS</Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Loja, CRM e oficina numa só operação.</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Esta área transforma o núcleo do CRM em central de comércio e produção 3D, mantendo clientes, WhatsApp, automações, financeiro e relatórios integrados.</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-200" href="/commerce/calculadora"><Calculator className="size-4" /> Calcular preço</Link>
            <Link className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 text-sm font-medium text-white transition hover:bg-white/10" href="/website"><Store className="size-4" /> Gerir site público</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.title} className="group border-border/70 transition hover:-translate-y-0.5 hover:border-cyan-500/30 hover:shadow-lg">
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between"><span className="rounded-xl bg-cyan-500/10 p-3 text-cyan-600 dark:text-cyan-300"><Icon className="size-5" /></span><Badge variant="secondary" className="text-[10px]">Estrutura pronta</Badge></div>
                <CardTitle className="text-lg">{module.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="min-h-16 text-sm leading-6 text-muted-foreground">{module.description}</p>
                <span className="mt-4 inline-flex items-center text-xs font-semibold text-cyan-700 dark:text-cyan-300">Configuração seguinte <ArrowRight className="ml-1 size-3.5 transition group-hover:translate-x-1" /></span>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card><CardHeader><CardTitle>Fluxo operacional preparado</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-5">{['Pedido', 'Pagamento', 'Produção', 'Qualidade', 'Envio'].map((step, index) => <div key={step} className="rounded-xl border bg-muted/30 p-3"><span className="text-[10px] font-bold text-cyan-600">0{index + 1}</span><p className="mt-2 text-sm font-semibold">{step}</p></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Base reutilizada do CRM</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">Autenticação, equipas, clientes, inbox, WhatsApp, automações, tarefas, financeiro, campanhas, portal, relatórios e configurações já fazem parte desta nova base POPForge.</CardContent></Card>
      </section>
    </div>
  );
}
