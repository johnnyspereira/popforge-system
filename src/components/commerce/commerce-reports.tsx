"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  Factory,
  TrendingUp,
} from "lucide-react";

type Data = {
  summary: Record<string, string | number>;
  categories: Array<{ category: string; total: string }>;
};
const money = (value: string | number | undefined) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
    Number(value || 0),
  );

export function CommerceReports() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/commerce/finance", {
      cache: "no-store",
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok)
      setError(json.error || "Não foi possível carregar os relatórios.");
    else setData(json);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const s = data?.summary || {};
  const revenue = Number(s.online_revenue || 0);
  const production =
    Number(s.production_material_cost || 0) +
    Number(s.production_other_cost || 0);
  const expenses = Number(s.operating_expenses || 0);
  const margin = revenue - production - expenses;
  const maximum = Math.max(
    ...(data?.categories || []).map((item) => Number(item.total)),
    1,
  );
  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <section className="overflow-hidden rounded-2xl bg-[#07151b] p-7 text-white sm:p-9">
        <p className="text-xs font-bold tracking-[.18em] text-cyan-300">
          INTELIGÊNCIA POPFORGE
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Relatórios que mostram o negócio.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Receita, custo real de produção e despesa operacional reunidos
              numa leitura objetiva.
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold"
          >
            Atualizar dados
          </button>
        </div>
      </section>
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric
          icon={<CircleDollarSign />}
          label="Receita confirmada"
          value={money(revenue)}
          detail="Encomendas online pagas"
        />
        <ReportMetric
          icon={<Factory />}
          label="Custo de produção"
          value={money(production)}
          detail="Materiais, energia e mão de obra"
        />
        <ReportMetric
          icon={<Boxes />}
          label="Despesas da operação"
          value={money(expenses)}
          detail="Fora de uma encomenda específica"
        />
        <ReportMetric
          icon={<TrendingUp />}
          label="Margem operacional"
          value={money(margin)}
          detail={
            revenue
              ? `${((margin / revenue) * 100).toFixed(1)}% da receita`
              : "Sem vendas confirmadas"
          }
        />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <article className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-cyan-600" />
            <h2 className="font-semibold">Como a receita é distribuída</h2>
          </div>
          <div className="mt-7 space-y-5">
            <ReportBar
              label="Custos de produção"
              value={production}
              maximum={Math.max(revenue, production + expenses, 1)}
              tone="bg-amber-400"
            />
            <ReportBar
              label="Despesas operacionais"
              value={expenses}
              maximum={Math.max(revenue, production + expenses, 1)}
              tone="bg-rose-400"
            />
            <ReportBar
              label="Margem restante"
              value={Math.max(0, margin)}
              maximum={Math.max(revenue, 1)}
              tone="bg-cyan-500"
            />
          </div>
          <p className="mt-7 text-xs text-muted-foreground">
            A margem usa apenas valores efetivamente registados; não estima
            custos que ainda não foram lançados.
          </p>
        </article>
        <article className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Maiores categorias de gasto</h2>
          <div className="mt-5 space-y-4">
            {data?.categories.length ? (
              data.categories.map((item) => (
                <div key={item.category}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{item.category}</span>
                    <strong>{money(item.total)}</strong>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{
                        width: `${Math.max(4, (Number(item.total) / maximum) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                Lance despesas no Financeiro POPForge para ver a distribuição
                por categoria.
              </p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
function ReportMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border bg-card p-5">
      <span className="text-cyan-600">{icon}</span>
      <p className="mt-6 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}
function ReportBar({
  label,
  value,
  maximum,
  tone,
}: {
  label: string;
  value: number;
  maximum: number;
  tone: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <strong>{money(value)}</strong>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.min(100, (value / maximum) * 100)}%` }}
        />
      </div>
    </div>
  );
}
