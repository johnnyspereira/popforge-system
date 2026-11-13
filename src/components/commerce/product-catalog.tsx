"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Box,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  ImageIcon,
  PackagePlus,
  Pencil,
  Search,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  status: "draft" | "active" | "archived";
  product_type: string;
  customizable: number;
  featured: number;
  variant_id: string;
  sku: string;
  variant_name: string;
  price: string;
  cost_price: string | null;
  stock_quantity: string;
  track_stock: number;
  material: string | null;
  color: string | null;
  weight_grams: string | null;
  kitComponents?: Array<{ variantId: string; quantity: number }>;
};
type FormState = {
  id?: string;
  variantId?: string;
  name: string;
  sku: string;
  description: string;
  imageUrl: string;
  price: string;
  costPrice: string;
  stock: string;
  material: string;
  color: string;
  weightGrams: string;
  productType: string;
  status: string;
  customizable: boolean;
  featured: boolean;
  trackStock: boolean;
  variantName: string;
  kitComponents: Array<{ variantId: string; quantity: number }>;
  sourceReference?: string;
};
const empty: FormState = {
  name: "",
  sku: "",
  description: "",
  imageUrl: "",
  price: "",
  costPrice: "",
  stock: "0",
  material: "",
  color: "",
  weightGrams: "",
  productType: "ready_made",
  status: "active",
  customizable: false,
  featured: false,
  trackStock: true,
  kitComponents: [],
  variantName: "Padrão",
};
const euro = (value: unknown) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
    Number(value || 0),
  );
const automaticSku = (name: string) => {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 18) || "PRODUTO";
  return `PF-${base}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
};

export function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [selected, setSelected] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await fetch("/api/commerce/products", {
      cache: "no-store",
    });
    const result = (await response.json().catch(() => ({}))) as {
      products?: Product[];
      error?: string;
    };
    if (!response.ok)
      setError(result.error || "Não foi possível carregar o catálogo.");
    setProducts(result.products || []);
    setSelected([]);
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visible = useMemo(() => {
      const filtered = products.filter((product) => {
        const match =
          `${product.name} ${product.sku} ${product.material || ""} ${product.color || ""}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return (
          match &&
          (filter === "all" ||
            product.status === filter ||
            (filter === "low" && Number(product.stock_quantity) <= 2))
        );
      });
      const grouped = new Map<string, Product & { variantCount: number }>();
      for (const product of filtered) {
        const current = grouped.get(product.id);
        if (current) current.variantCount += 1;
        else grouped.set(product.id, { ...product, variantCount: 1 });
      }
      return [...grouped.values()];
    }, [filter, products, query]);
  const active = new Set(products.filter((p) => p.status === "active").map((p) => p.id)).size;
  const low = new Set(products.filter(
    (p) => Number(p.stock_quantity) <= 2 && p.status !== "archived",
  ).map((p) => p.id)).size;
  const value = products.reduce(
    (sum, p) => sum + Number(p.cost_price || 0) * Number(p.stock_quantity || 0),
    0,
  );

  function edit(product: Product) {
    setForm({
      id: product.id,
      variantId: product.variant_id,
      name: product.name,
      sku: product.sku,
      description: product.description || "",
      imageUrl: product.image_url || "",
      price: String(product.price),
      costPrice: String(product.cost_price || ""),
      stock: String(product.stock_quantity),
      material: product.material || "",
      color: product.color || "",
      weightGrams: String(product.weight_grams || ""),
      productType: product.product_type,
      status: product.status,
      customizable: Boolean(product.customizable),
      featured: Boolean(product.featured),
      trackStock: Boolean(product.track_stock),
      kitComponents: product.kitComponents || [],
      variantName: product.variant_name || "Padrão",
    });
    setError("");
    setOpen(true);
  }
  function create() {
    setForm(empty);
    setError("");
    setOpen(true);
  }
  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function uploadImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Escolha um ficheiro de imagem.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("A imagem pode ter no máximo 8 MB.");
      return;
    }
    setUploading(true);
    setError("");
    const data = new FormData();
    data.set("file", file);
    const response = await fetch("/api/storage/commerce-products/upload", {
      method: "POST",
      body: data,
    });
    const result = (await response.json().catch(() => ({}))) as {
      data?: { publicUrl?: string };
      error?: { message?: string };
    };
    setUploading(false);
    if (!response.ok || !result.data?.publicUrl) {
      setError(result.error?.message || "Não foi possível carregar a imagem.");
      return;
    }
    field("imageUrl", result.data.publicUrl);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/commerce/products", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setSaving(false);
    if (!response.ok) {
      setError(result.error || "Não foi possível guardar o produto.");
      return;
    }
    setOpen(false);
    await load();
  }
  async function archive(product: Product) {
    if (
      !window.confirm(
        `Arquivar “${product.name}”? O produto deixará de aparecer na loja.`,
      )
    )
      return;
    await fetch(`/api/commerce/products?id=${encodeURIComponent(product.id)}`, {
      method: "DELETE",
    });
    await load();
  }
  async function archiveSelected() {
    if (!selected.length || !window.confirm(`Arquivar ${selected.length} produtos selecionados? Deixarão de aparecer na loja.`)) return;
    const response = await fetch(`/api/commerce/products?ids=${encodeURIComponent(selected.join(","))}`, { method: "DELETE" });
    if (!response.ok) { setError("Não foi possível arquivar os produtos selecionados."); return; }
    await load();
  }
  async function importFromUrl(event: React.FormEvent) {
    event.preventDefault(); setImporting(true); setError("");
    try {
      const parsed = new URL(importUrl);
      const fallbackName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '').replace(/^\d+-/, '').replace(/[-_]+/g, ' ').replace(/\b\d{5,}\b/g, '').replace(/\s+/g, ' ').trim();
      if (fallbackName) {
        setForm((current) => ({ ...current, name: fallbackName.slice(0, 180), sku: current.sku || automaticSku(fallbackName), description: current.description || `Referência importada de ${parsed.hostname}.`, sourceReference: parsed.toString() }));
        setImporting(false); setImportOpen(false); setImportUrl(""); setOpen(true);
        void fetch("/api/commerce/products/import-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: parsed.toString() }), signal: AbortSignal.timeout(20000) }).then(async (response) => {
          const result = await response.json().catch(() => ({})) as { data?: { name?: string; description?: string; imageUrl?: string } };
          if (response.ok && result.data) setForm((current) => ({ ...current, name: result.data?.name || current.name, description: result.data?.description || current.description, imageUrl: result.data?.imageUrl || current.imageUrl }));
        }).catch(() => undefined);
        return;
      }
    } catch { /* let the API return the validation message */ }
    let response: Response;
    try {
      response = await fetch("/api/commerce/products/import-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: importUrl }), signal: AbortSignal.timeout(20000) });
    } catch {
      setImporting(false); setError("O servidor não respondeu ao importador. Atualize o runtime do cPanel e tente novamente."); return;
    }
    const result = await response.json().catch(() => ({})) as { error?: string; warning?: string; data?: { name?: string; description?: string; imageUrl?: string } };
    setImporting(false);
    if (!response.ok || !result.data) {
      try {
        const parsed = new URL(importUrl);
        const fallbackName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '').replace(/^\d+-/, '').replace(/[-_]+/g, ' ').replace(/\b\d{5,}\b/g, '').replace(/\s+/g, ' ').trim();
        if (fallbackName) {
          setForm((current) => ({ ...current, name: fallbackName.slice(0, 180), sku: current.sku || automaticSku(fallbackName), description: current.description || `Referência importada de ${parsed.hostname}.`, sourceReference: parsed.toString() } as FormState));
          setImportOpen(false); setImportUrl(""); setOpen(true); setError("O site não permitiu obter a imagem automaticamente. O rascunho foi criado; complete a imagem e confirme os dados."); return;
        }
      } catch { /* handled by the normal message below */ }
      setError(result.error || "Não foi possível importar este link."); return;
    }
    const importedName = result.data?.name || "";
    setForm((current) => ({ ...current, name: importedName || current.name, sku: current.sku || automaticSku(importedName), description: result.data?.description || current.description, imageUrl: result.data?.imageUrl || current.imageUrl }));
    setImportOpen(false); setImportUrl(""); setOpen(true); if (result.warning) setError(result.warning);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_85%_0%,rgba(34,211,238,.22),transparent_35%),linear-gradient(135deg,#071218,#10313b)] p-6 text-white sm:p-8">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold tracking-[.18em] text-cyan-300 uppercase">
              Catálogo POPForge
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Produtos e variantes
            </h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Prepare produtos completos para venda, controle margens e publique
              na loja sem sair do painel.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}><ExternalLink className="size-4"/> Importar por link</Button>
            <Link href="/commerce/encomendas" className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 text-sm font-medium hover:bg-white/10">
              Gerir encomendas
            </Link>
            <a
              href="/"
              target="_blank"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 text-sm font-medium hover:bg-white/10"
            >
              Ver loja <ExternalLink className="size-4" />
            </a>
            <Button
              onClick={create}
              className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
            >
              <PackagePlus />
              Novo produto
            </Button>
          </div>
        </div>
      </section>
      {importOpen ? <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/70 p-4"><form onSubmit={importFromUrl} className="w-full max-w-xl space-y-5 rounded-2xl border bg-background p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-wider text-cyan-600 uppercase">Importação assistida</p><h2 className="mt-1 text-xl font-bold">Importar produto por link</h2><p className="mt-2 text-sm text-muted-foreground">Cole um link público. Vamos trazer título, descrição e imagem para rever antes de criar.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setImportOpen(false)}><X/></Button></div><Input autoFocus type="url" required value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="https://makerworld.com/pt/models/..."/><p className="text-xs text-muted-foreground">Os ficheiros do site original não são copiados automaticamente. Verifique direitos de uso, preço, SKU e produção antes de publicar.</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button><Button disabled={importing}>{importing ? "A ler link…" : "Ler e preencher"}</Button></div></form></div> : null}
      <section className="grid gap-3 md:grid-cols-3">
        <FlowCard step="1" title="Prepare a peça" text="Defina preço, custo, stock e dados de produção." />
        <FlowCard step="2" title="Publique na loja" text="Produtos publicados ficam disponíveis para o cliente comprar." />
        <FlowCard step="3" title="Acompanhe a encomenda" text="Use Encomendas para confirmar pagamento, produção e envio." />
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric
          icon={CheckCircle2}
          label="Produtos publicados"
          value={active}
        />
        <Metric
          icon={TriangleAlert}
          label="Stock baixo"
          value={low}
          tone="amber"
        />
        <Metric
          icon={CircleDollarSign}
          label="Valor de custo em stock"
          value={euro(value)}
        />
      </section>
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 pl-9"
                placeholder="Pesquisar nome, SKU, material ou cor…"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "Todos"],
                ["active", "Publicados"],
                ["draft", "Rascunhos"],
                ["low", "Stock baixo"],
                ["archived", "Arquivados"],
              ].map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filter === key ? "default" : "outline"}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          {selected.length ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><span><b>{selected.length}</b> produto(s) selecionado(s)</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setSelected([])}>Limpar seleção</Button><Button size="sm" variant="destructive" onClick={() => void archiveSelected()}><Archive className="size-4"/> Arquivar selecionados</Button></div></div> : null}
        </CardContent>
      </Card>
      {error && !open ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center text-muted-foreground">
              A carregar catálogo…
            </div>
          ) : visible.length === 0 ? (
            <div className="py-20 text-center">
              <Box className="mx-auto size-12 text-muted-foreground/50" />
              <h2 className="mt-4 text-lg font-semibold">
                O catálogo está pronto para o primeiro produto
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Adicione fotografia, preço, SKU e stock para publicar na loja.
              </p>
              <Button onClick={create} className="mt-5">
                <PackagePlus />
                Criar produto
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              <div className="flex items-center gap-3 border-b bg-muted/20 px-4 py-3 text-sm"><input type="checkbox" aria-label="Selecionar todos os produtos visíveis" checked={visible.length > 0 && visible.every((product) => selected.includes(product.id))} onChange={(event) => setSelected(event.target.checked ? Array.from(new Set([...selected, ...visible.map((product) => product.id)])) : selected.filter((id) => !visible.some((product) => product.id === id)))} /><span>Selecionar produtos visíveis</span></div>
              {visible.map((product) => (
                <div
                  key={product.variant_id}
                  className="grid gap-4 p-4 transition hover:bg-muted/30 sm:grid-cols-[72px_minmax(0,1fr)_120px_110px_120px] sm:items-center"
                >
                  <div className="flex items-center gap-3"><input type="checkbox" aria-label={`Selecionar ${product.name}`} checked={selected.includes(product.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, product.id] : selected.filter((id) => id !== product.id))} /><ProductImage url={product.image_url} name={product.name} /></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{product.name}</p>
                      {product.featured ? (
                        <Badge className="bg-cyan-500/10 text-cyan-700">
                          <Sparkles className="size-3" />
                          Destaque
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      SKU {product.sku} ·{" "}
                      {[product.material, product.color]
                        .filter(Boolean)
                        .join(" · ") || "Sem atributos"}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">{euro(product.price)}</p>
                    {product.cost_price ? (
                      <p className="text-xs text-muted-foreground">
                        Custo {euro(product.cost_price)}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p
                      className={
                        Number(product.stock_quantity) <= 2
                          ? "font-semibold text-amber-600"
                          : "font-semibold"
                      }
                    >
                      {Number(product.stock_quantity)} un.
                    </p>
                    <p className="text-xs text-muted-foreground">em stock</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <Badge
                      variant={
                        product.status === "active" ? "default" : "secondary"
                      }
                    >
                      {product.status === "active"
                        ? "Publicado"
                        : product.status === "draft"
                          ? "Rascunho"
                          : "Arquivado"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => edit(product)}
                      aria-label="Editar"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void archive(product)}
                      aria-label="Arquivar"
                    >
                      <Archive />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {open ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6">
          <form
            onSubmit={save}
            onPaste={(event) => { const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/")); if (file) { event.preventDefault(); void uploadImage(file); } }}
            className="mx-auto my-4 max-w-6xl overflow-hidden rounded-3xl border bg-background shadow-2xl"
          >
            <header className="flex items-center justify-between border-b px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold tracking-wider text-cyan-600 uppercase">
                  {form.id ? "Editar catálogo" : "Novo produto"}
                </p>
                <h2 className="text-xl font-bold">
                  {form.id ? form.name : "Adicionar produto à loja"}
                </h2>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </header>
            <div className="grid min-w-0 gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-6">
                <Section title="Informação principal">
                  <Field label="Nome do produto" required>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((current) => ({ ...current, name: e.target.value, sku: current.sku || automaticSku(e.target.value) }))}
                      required
                      placeholder="Ex.: Suporte para comando personalizado"
                    />
                  </Field>
                  <Field label="Descrição">
                    <textarea
                      value={form.description}
                      onChange={(e) => field("description", e.target.value)}
                      rows={5}
                      className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                      placeholder="Explique materiais, acabamento, medidas e diferenciais…"
                    />
                  </Field>
                  <Field label="Fotografia do produto">
                    <label onPaste={(event) => { const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/")); if (file) { event.preventDefault(); void uploadImage(file); } }} tabIndex={0} className="text-muted-foreground hover:border-cyan-500 hover:text-foreground flex cursor-pointer items-center justify-center rounded-xl border border-dashed p-4 text-sm">
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadImage(file);
                        }}
                      />
                      {uploading
                        ? "A carregar imagem…"
                        : form.imageUrl
                          ? "Substituir fotografia"
                          : "Escolher fotografia"}
                    </label>
                  </Field>
                </Section>
                <Section title="Preço e identificação">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="SKU" required>
                      <Input
                        value={form.sku}
                        onChange={(e) =>
                          field("sku", e.target.value.toUpperCase())
                        }
                        required
                        placeholder="Gerado automaticamente"
                      />
                    </Field>
                    <Field label="Preço de venda (€)" required>
                      <Input
                        value={form.price}
                        onChange={(e) => field("price", e.target.value)}
                        type="number"
                        min="0"
                        step="0.01"
                        required
                      />
                    </Field>
                    <Field label="Custo (€)">
                      <Input
                        value={form.costPrice}
                        onChange={(e) => field("costPrice", e.target.value)}
                        type="number"
                        min="0"
                        step="0.01"
                      />
                    </Field>
                  </div>
                </Section>
                <Section title="Produção e variante">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Material">
                      <Input
                        value={form.material}
                        onChange={(e) => field("material", e.target.value)}
                        placeholder="PLA, PETG…"
                      />
                    </Field>
                    <Field label="Cor">
                      <Input
                        value={form.color}
                        onChange={(e) => field("color", e.target.value)}
                      />
                    </Field>
                    <Field label="Peso (g)">
                      <Input
                        value={form.weightGrams}
                        onChange={(e) => field("weightGrams", e.target.value)}
                        type="number"
                        min="0"
                        step="0.1"
                      />
                    </Field>
                    <Field label="Stock">
                      <Input
                        value={form.stock}
                        onChange={(e) => field("stock", e.target.value)}
                        type="number"
                        min="0"
                        step="1"
                      />
                    </Field>
                  </div>
                </Section>
                {form.productType === "kit" ? (
                  <Section title="Composição do kit">
                    <p className="mb-3 text-sm text-muted-foreground">Escolha as peças que devem estar concluídas para este kit poder seguir para expedição.</p>
                    <div className="space-y-3">
                      {form.kitComponents.map((component, index) => {
                        const selected = products.find((product) => product.variant_id === component.variantId);
                        return <div key={`${component.variantId}-${index}`} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_110px_auto]">
                          <select value={component.variantId} onChange={(event) => field("kitComponents", form.kitComponents.map((item, itemIndex) => itemIndex === index ? { ...item, variantId: event.target.value } : item))} className="h-10 rounded-lg border bg-background px-3 text-sm">
                            <option value="">Escolher peça</option>
                            {products.filter((product) => product.variant_id !== form.variantId && product.product_type !== "kit").map((product) => <option key={product.variant_id} value={product.variant_id}>{product.name} · {product.sku}</option>)}
                          </select>
                          <Input value={String(component.quantity)} onChange={(event) => field("kitComponents", form.kitComponents.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item))} type="number" min="1" aria-label={selected ? `Quantidade de ${selected.name}` : "Quantidade"} />
                          <Button type="button" variant="outline" onClick={() => field("kitComponents", form.kitComponents.filter((_, itemIndex) => itemIndex !== index))}>Remover</Button>
                        </div>;
                      })}
                      <Button type="button" variant="outline" onClick={() => field("kitComponents", [...form.kitComponents, { variantId: "", quantity: 1 }])}>Adicionar peça ao kit</Button>
                    </div>
                  </Section>
                ) : null}
              </div>
              <aside className="space-y-5">
                <div className="overflow-hidden rounded-2xl border bg-muted/20">
                  <ProductImage
                    url={form.imageUrl || null}
                    name={form.name || "Produto"}
                    large
                  />
                </div>
                <Section title="Publicação">
                  <Field label="Estado">
                    <select
                      value={form.status}
                      onChange={(e) => field("status", e.target.value)}
                      className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                    >
                      <option value="active">Publicado</option>
                      <option value="draft">Rascunho</option>
                      <option value="archived">Arquivado</option>
                    </select>
                  </Field>
                  <Field label="Tipo">
                    <select
                      value={form.productType}
                      onChange={(e) => field("productType", e.target.value)}
                      className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                    >
                      <option value="ready_made">Pronta entrega</option>
                      <option value="made_to_order">
                        Produzido por encomenda
                      </option>
                      <option value="kit">Kit com peças de produção</option>
                      <option value="custom_quote">
                        Orçamento personalizado
                      </option>
                    </select>
                  </Field>
                  <Check
                    label="Produto em destaque"
                    checked={form.featured}
                    onChange={(v) => field("featured", v)}
                  />
                  <Check
                    label="Permite personalização"
                    checked={form.customizable}
                    onChange={(v) => field("customizable", v)}
                  />
                  <Check
                    label="Controlar stock"
                    checked={form.trackStock}
                    onChange={(v) => field("trackStock", v)}
                  />
                </Section>
              </aside>
            </div>
            {error ? (
              <div className="mx-5 mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 sm:mx-7">
                {error}
              </div>
            ) : null}
            <footer className="flex justify-end gap-3 border-t bg-muted/20 px-5 py-4 sm:px-7">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button nativeButton={false} type="submit" disabled={saving || uploading} className="min-w-36">
                {saving
                  ? "A guardar…"
                  : form.id
                    ? "Guardar alterações"
                    : "Criar produto"}
              </Button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function FlowCard({ step, title, text }: { step: string; title: string; text: string }) {
  return <div className="rounded-xl border bg-card p-4"><span className="grid size-7 place-items-center rounded-full bg-cyan-500/10 text-sm font-bold text-cyan-700">{step}</span><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>;
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "cyan",
}: {
  icon: typeof Box;
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span
          className={
            tone === "amber"
              ? "rounded-xl bg-amber-500/10 p-3 text-amber-600"
              : "rounded-xl bg-cyan-500/10 p-3 text-cyan-600"
          }
        >
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
function ProductImage({
  url,
  name,
  large = false,
}: {
  url: string | null;
  name: string;
  large?: boolean;
}) {
  return (
    <div
      className={
        large
          ? "flex aspect-square items-center justify-center bg-slate-100 dark:bg-slate-900"
          : "flex size-[72px] items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900"
      }
    >
      {url ? (
        <div
          role="img"
          aria-label={name}
          className="size-full bg-cover bg-center"
          style={{ backgroundImage: `url(${url})` }}
        />
      ) : (
        <ImageIcon
          className={
            large
              ? "size-16 text-muted-foreground/40"
              : "size-7 text-muted-foreground/40"
          }
        />
      )}
    </div>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h3 className="border-b pb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}
function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}
function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4"
      />
      {label}
    </label>
  );
}
