"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Box,
  Check,
  ChevronRight,
  Menu,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from "lucide-react";

export type StoreProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  variantId: string;
  variantName: string;
  material: string | null;
  color: string | null;
  productType: string;
  customizable: boolean;
  featured: boolean;
  price: number;
  compareAtPrice: number | null;
  stock: number;
};
const money = (value: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
    value,
  );

export function PublicStorefront({ products }: { products: StoreProduct[] }) {
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const featured = products.find((product) => product.featured) || products[0];
  const visible = useMemo(
    () =>
      products.filter((product) =>
        `${product.name} ${product.description || ""} ${product.material || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [products, query],
  );

  async function order(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || ordering) return;
    setOrdering(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/storefront/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId: selected.variantId,
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        quantity: Number(form.get("quantity")),
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      orderNumber?: number;
      error?: string;
    };
    setOrdering(false);
    setMessage(
      response.ok
        ? `Encomenda #${result.orderNumber} recebida com sucesso.`
        : result.error || "Não foi possível enviar a encomenda.",
    );
    if (response.ok) setSelected(null);
  }

  return (
    <div className="min-h-screen bg-[#05090d] text-white selection:bg-cyan-300 selection:text-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05090d]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 font-black text-cyan-300">
              PF
            </span>
            <div>
              <p className="text-lg font-black leading-none tracking-tight">
                <span className="text-cyan-300">POP</span>FORGE
              </p>
              <p className="mt-1 text-[9px] font-semibold tracking-[.28em] text-slate-500 uppercase">
                Custom 3D creations
              </p>
            </div>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 md:flex">
            <a href="#catalogo" className="hover:text-cyan-300">
              Produtos
            </a>
            <a href="#personalizado" className="hover:text-cyan-300">
              Personalização
            </a>
            <a href="#processo" className="hover:text-cyan-300">
              Como funciona
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="/login"
              className="hidden rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:border-cyan-300/30 hover:text-white sm:block"
            >
              Área de gestão
            </a>
            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="rounded-xl border border-white/10 p-2.5 md:hidden"
              aria-label="Menu"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
        {mobileMenu ? (
          <nav className="border-t border-white/10 px-5 py-4 md:hidden">
            <a
              onClick={() => setMobileMenu(false)}
              href="#catalogo"
              className="block py-3"
            >
              Produtos
            </a>
            <a
              onClick={() => setMobileMenu(false)}
              href="#personalizado"
              className="block py-3"
            >
              Personalização
            </a>
            <a
              onClick={() => setMobileMenu(false)}
              href="#processo"
              className="block py-3"
            >
              Como funciona
            </a>
          </nav>
        ) : null}
      </header>
      <main id="top">
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_25%,rgba(34,211,238,.18),transparent_30%),radial-gradient(circle_at_30%_0%,rgba(14,116,144,.12),transparent_32%)]" />
          <div className="mx-auto grid min-h-[720px] max-w-[1440px] items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr]">
            <div className="relative z-10">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-bold tracking-wide text-cyan-200">
                <Sparkles className="size-4" /> IMPRESSÃO 3D · CRIADA EM
                PORTUGAL
              </p>
              <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[.96] tracking-[-.055em] sm:text-7xl xl:text-[92px]">
                Do digital para o{" "}
                <span className="bg-gradient-to-r from-cyan-200 to-cyan-500 bg-clip-text text-transparent">
                  extraordinário.
                </span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">
                Colecionáveis, decoração e peças personalizadas produzidas
                camada a camada, com atenção obsessiva ao detalhe.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href="#catalogo"
                  className="inline-flex h-13 items-center gap-2 rounded-xl bg-cyan-300 px-6 font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200"
                >
                  Explorar coleção <ArrowRight className="size-4" />
                </a>
                <a
                  href="#personalizado"
                  className="inline-flex h-13 items-center rounded-xl border border-white/15 bg-white/5 px-6 font-semibold hover:bg-white/10"
                >
                  Criar algo único
                </a>
              </div>
              <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400">
                {[
                  "Produção local",
                  "Peças verificadas",
                  "Acompanhamento real",
                ].map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <Check className="size-4 text-cyan-300" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative mx-auto aspect-square w-full max-w-[600px]">
              <div className="absolute inset-[6%] rounded-full border border-cyan-300/25 shadow-[0_0_120px_rgba(34,211,238,.15),inset_0_0_80px_rgba(34,211,238,.08)]" />
              <div className="absolute inset-[14%] rotate-6 rounded-[32%_68%_55%_45%/45%_40%_60%_55%] bg-gradient-to-br from-cyan-300/25 via-sky-700/10 to-transparent blur-2xl" />
              {featured ? (
                <button
                  onClick={() => setSelected(featured)}
                  className="absolute inset-[16%] overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/[.02] shadow-2xl transition hover:scale-[1.02]"
                >
                  <ProductVisual product={featured} hero />
                  <span className="absolute right-5 bottom-5 left-5 flex items-center justify-between rounded-2xl border border-white/10 bg-black/55 p-4 text-left backdrop-blur">
                    <span>
                      <span className="block text-xs text-cyan-300">
                        EM DESTAQUE
                      </span>
                      <strong className="mt-1 block text-lg">
                        {featured.name}
                      </strong>
                    </span>
                    <span className="text-xl font-black">
                      {money(featured.price)}
                    </span>
                  </span>
                </button>
              ) : (
                <div className="absolute inset-[16%] flex items-center justify-center rounded-[2.5rem] border border-white/10 bg-white/[.03]">
                  <Box className="size-36 text-cyan-300" strokeWidth={0.65} />
                </div>
              )}
            </div>
          </div>
        </section>
        <section
          id="catalogo"
          className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8"
        >
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold tracking-[.2em] text-cyan-300 uppercase">
                Catálogo POPForge
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Feito para se destacar.
              </h2>
              <p className="mt-3 max-w-xl text-slate-400">
                Peças produzidas em pequenas séries ou especialmente para si.
              </p>
            </div>
            {products.length > 4 ? (
              <div className="relative w-full md:max-w-sm">
                <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 outline-none focus:border-cyan-300/50"
                  placeholder="Pesquisar produtos…"
                />
              </div>
            ) : null}
          </div>
          {products.length === 0 ? (
            <div className="mt-12 grid min-h-80 place-items-center rounded-3xl border border-dashed border-white/15 bg-white/[.025] text-center">
              <div>
                <Box
                  className="mx-auto size-16 text-cyan-300/60"
                  strokeWidth={0.8}
                />
                <h3 className="mt-5 text-2xl font-bold">
                  A primeira coleção está a nascer
                </h3>
                <p className="mt-2 text-slate-400">
                  Estamos a preparar peças que merecem ocupar um lugar especial.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((product) => (
                <article
                  key={product.variantId}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[.035] transition hover:-translate-y-1 hover:border-cyan-300/30"
                >
                  <button
                    onClick={() => setSelected(product)}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#0a1319]">
                      <ProductVisual product={product} />
                      <div className="absolute top-4 left-4 flex gap-2">
                        {product.featured ? (
                          <span className="rounded-full bg-cyan-300 px-3 py-1 text-[10px] font-black text-slate-950">
                            DESTAQUE
                          </span>
                        ) : null}
                        {product.customizable ? (
                          <span className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[10px] font-bold backdrop-blur">
                            PERSONALIZÁVEL
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold tracking-wide text-cyan-300 uppercase">
                            {product.material || "Impressão 3D"}
                          </p>
                          <h3 className="mt-2 text-xl font-bold">
                            {product.name}
                          </h3>
                        </div>
                        <ChevronRight className="mt-1 size-5 text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
                      </div>
                      <p className="mt-3 line-clamp-2 min-h-12 text-sm leading-6 text-slate-400">
                        {product.description ||
                          "Produção cuidada, acabamento rigoroso e personalidade POPForge."}
                      </p>
                      <div className="mt-6 flex items-end justify-between">
                        <div>
                          {product.compareAtPrice &&
                          product.compareAtPrice > product.price ? (
                            <p className="text-xs text-slate-600 line-through">
                              {money(product.compareAtPrice)}
                            </p>
                          ) : null}
                          <strong className="text-2xl">
                            {money(product.price)}
                          </strong>
                        </div>
                        <span className="rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-400">
                          {product.productType === "made_to_order"
                            ? "Por encomenda"
                            : product.stock > 0
                              ? `${product.stock} disponíveis`
                              : "Sob consulta"}
                        </span>
                      </div>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
        <section
          id="personalizado"
          className="border-y border-white/5 bg-[#081118]"
        >
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:items-center">
            <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.2),transparent_33%),linear-gradient(145deg,#101d25,#05090d)]">
              <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:32px_32px]" />
              <Box
                className="absolute top-1/2 left-1/2 size-48 -translate-x-1/2 -translate-y-1/2 rotate-[-8deg] text-cyan-300 drop-shadow-[0_0_35px_rgba(34,211,238,.35)]"
                strokeWidth={0.65}
              />
            </div>
            <div>
              <p className="text-xs font-bold tracking-[.2em] text-cyan-300 uppercase">
                Projeto personalizado
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                A sua ideia não precisa ficar no papel.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-400">
                Conte-nos o que imagina. Analisamos formato, dimensão, material,
                acabamento e viabilidade para transformar a ideia numa peça
                real.
              </p>
              <a
                href="mailto:popforge@jpmassagem.pt?subject=Pedido%20de%20orçamento%20personalizado"
                className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-cyan-300 px-5 font-bold text-slate-950"
              >
                Pedir orçamento <ArrowRight className="size-4" />
              </a>
            </div>
          </div>
        </section>
        <section
          id="processo"
          className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8"
        >
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[.2em] text-cyan-300 uppercase">
              Da ideia à entrega
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">
              Um processo cuidado, sem mistérios.
            </h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                Icon: PackageCheck,
                title: "Preparação",
                text: "Confirmamos detalhes, material, cor e escala antes de produzir.",
              },
              {
                Icon: ShieldCheck,
                title: "Produção e qualidade",
                text: "Cada peça é acompanhada e verificada antes do acabamento.",
              },
              {
                Icon: Truck,
                title: "Envio acompanhado",
                text: "Recebe atualizações da encomenda até à entrega.",
              },
            ].map(({ Icon, title, text }, index) => (
              <div
                key={title}
                className="rounded-3xl border border-white/10 bg-white/[.03] p-7"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-xl bg-cyan-300/10 p-3 text-cyan-300">
                    <Icon className="size-6" />
                  </span>
                  <span className="text-4xl font-black text-white/5">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-8 text-xl font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-6 px-5 py-10 text-sm text-slate-500 sm:px-8 md:flex-row">
          <p>© {new Date().getFullYear()} POPForge Lab. Custom 3D Creations.</p>
          <div className="flex gap-6">
            <a
              href="mailto:popforge@jpmassagem.pt"
              className="hover:text-white"
            >
              Contacto
            </a>
            <a href="/login" className="hover:text-white">
              Gestão
            </a>
          </div>
        </div>
      </footer>
      {selected ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
          <div className="mx-auto my-6 grid max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b1218] shadow-2xl md:grid-cols-[.9fr_1.1fr]">
            <div className="relative min-h-72 bg-[#071016]">
              <ProductVisual product={selected} hero />
            </div>
            <form onSubmit={order} className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-cyan-300 uppercase">
                    {selected.material || "POPForge"}
                  </p>
                  <h2 className="mt-2 text-3xl font-black">{selected.name}</h2>
                  <p className="mt-2 text-2xl font-bold">
                    {money(selected.price)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-full border border-white/10 p-2"
                >
                  <X />
                </button>
              </div>
              <p className="mt-5 text-sm leading-6 text-slate-400">
                {selected.description}
              </p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <input
                  name="name"
                  required
                  placeholder="Nome completo"
                  className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 outline-none focus:border-cyan-300/50"
                />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="E-mail"
                  className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 outline-none focus:border-cyan-300/50"
                />
                <input
                  name="phone"
                  type="tel"
                  required
                  placeholder="Telefone / WhatsApp"
                  className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 outline-none focus:border-cyan-300/50"
                />
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  max={selected.stock || 25}
                  defaultValue="1"
                  className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 outline-none focus:border-cyan-300/50"
                />
              </div>
              <button
                disabled={ordering}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-60"
              >
                <ShoppingBag className="size-4" />
                {ordering ? "A enviar…" : "Fazer encomenda"}
              </button>
              <p className="mt-3 text-center text-xs text-slate-500">
                Receberá contacto para confirmação e pagamento.
              </p>
            </form>
          </div>
        </div>
      ) : null}
      {message ? (
        <button
          onClick={() => setMessage("")}
          className="fixed right-5 bottom-5 z-[90] max-w-sm rounded-2xl border border-cyan-300/30 bg-cyan-300 px-5 py-4 text-left font-semibold text-slate-950 shadow-2xl"
        >
          {message}
        </button>
      ) : null}
    </div>
  );
}

function ProductVisual({
  product,
  hero = false,
}: {
  product: StoreProduct;
  hero?: boolean;
}) {
  return product.imageUrl ? (
    <div
      role="img"
      aria-label={product.name}
      className="size-full bg-cover bg-center transition duration-700 group-hover:scale-105"
      style={{
        backgroundImage: `linear-gradient(to top,rgba(5,9,13,.25),transparent 50%),url(${product.imageUrl})`,
      }}
    />
  ) : (
    <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_50%_40%,rgba(34,211,238,.22),transparent_42%)]">
      <Box
        className={hero ? "size-40 text-cyan-300" : "size-24 text-cyan-300"}
        strokeWidth={0.7}
      />
    </div>
  );
}
