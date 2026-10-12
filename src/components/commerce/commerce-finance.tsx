"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CircleDollarSign,
  Landmark,
  ReceiptText,
  TrendingUp,
} from "lucide-react";

type Entry = {
  id: string;
  entry_type: string;
  category: string;
  description: string;
  amount: string;
  occurred_on: string;
  payment_method: string | null;
  order_number: number | null;
};
type Data = {
  summary: Record<string, string | number>;
  entries: Entry[];
  orders: Array<{
    id: string;
    order_number: number;
    customer_name: string | null;
  }>;
};
const money = (value: string | number | undefined) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
    Number(value || 0),
  );
const labels: Record<string, string> = {
  initial_investment: "Investimento inicial",
  capital_injection: "Novo investimento",
  operating_expense: "Despesa operacional",
  owner_draw: "Retirada do proprietário",
};

export function CommerceFinance() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/commerce/finance", {
      cache: "no-store",
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok)
      setError(json.error || "Não foi possível abrir o financeiro.");
    else setData(json);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const s = data?.summary || {};
  const revenue = Number(s.online_revenue || 0);
  const costs =
    Number(s.production_material_cost || 0) +
    Number(s.production_other_cost || 0) +
    Number(s.operating_expenses || 0);
  const margin = revenue - costs;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/commerce/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const json = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(json.error || "Não foi possível lançar o movimento.");
      return;
    }
    event.currentTarget.reset();
    await load();
  }
  return (
    <div className="space-y-7 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-sm font-semibold text-cyan-600">
          FINANCEIRO POPFORGE
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Capital, custos e margem
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          O POS e as encomendas registam receitas. Aqui controla o capital
          investido, despesas reais e a margem da operação 3D.
        </p>
      </header>
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<CircleDollarSign />}
          label="Receita da loja paga"
          value={money(s.online_revenue)}
        />
        <Metric
          icon={<ReceiptText />}
          label="Custos de produção"
          value={money(
            Number(s.production_material_cost || 0) +
              Number(s.production_other_cost || 0),
          )}
        />
        <Metric
          icon={<Landmark />}
          label="Capital investido"
          value={money(s.invested)}
        />
        <Metric
          icon={<TrendingUp />}
          label="Margem operacional"
          value={money(margin)}
        />
      </section>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)]">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Lançar movimento financeiro</h2>
          <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Tipo
              <select
                name="entryType"
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              >
                <option value="initial_investment">Investimento inicial</option>
                <option value="capital_injection">Novo investimento</option>
                <option value="operating_expense">Despesa operacional</option>
                <option value="owner_draw">Retirada do proprietário</option>
              </select>
            </label>
            <label className="text-sm">
              Categoria
              <input
                required
                name="category"
                placeholder="Ex.: Impressora, publicidade, renda"
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              Descrição
              <input
                required
                name="description"
                placeholder="Ex.: Compra da Creality SPARKX i7"
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <label className="text-sm">
              Valor (€)
              <input
                required
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <label className="text-sm">
              Data
              <input
                required
                name="occurredOn"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <label className="text-sm">
              Método
              <input
                name="paymentMethod"
                placeholder="Cartão, MB WAY, transferência…"
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <label className="text-sm">
              Ligar a encomenda
              <select
                name="orderId"
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              >
                <option value="">Sem encomenda específica</option>
                {data?.orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    #{order.order_number} · {order.customer_name || "Cliente"}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              Referência / nota
              <input
                name="reference"
                placeholder="Fatura, fornecedor ou código interno"
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50 sm:col-span-2"
            >
              {saving ? "A guardar…" : "Registar movimento"}
            </button>
          </form>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Leitura da operação</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Vendas POS registadas" value={money(s.pos_revenue)} />
            <Row
              label="Despesas operacionais"
              value={money(s.operating_expenses)}
            />
            <Row label="Retiradas" value={money(s.owner_draws)} />
            <Row
              label="Retorno sobre capital"
              value={
                Number(s.invested || 0)
                  ? `${((margin / Number(s.invested)) * 100).toFixed(1)}%`
                  : "—"
              }
            />
          </dl>
          <p className="mt-6 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            O POS continua disponível em Financeiro → Registar venda. Vendas
            online confirmadas, pedidos manuais e consumos da oficina permanecem
            ligados à mesma operação.
          </p>
        </div>
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Movimentos recentes</h2>
        <div className="mt-4 divide-y">
          {data?.entries.length ? (
            data.entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {labels[entry.entry_type] || entry.entry_type} ·{" "}
                    {entry.category}
                    {entry.order_number
                      ? ` · Encomenda #${entry.order_number}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <strong>{money(entry.amount)}</strong>
                  <p className="text-xs text-muted-foreground">
                    {entry.occurred_on.slice(0, 10)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="py-8 text-sm text-muted-foreground">
              Ainda não existem investimentos ou despesas registados.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <span className="text-cyan-600">{icon}</span>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b pb-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
