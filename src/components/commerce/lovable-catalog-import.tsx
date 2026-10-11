"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LovableCatalogImport() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true); setMessage("");
    const response = await fetch("/api/commerce/catalog/import-lovable", { method: "POST" });
    const result = await response.json().catch(() => ({})) as { error?: string; products?: number; variants?: number };
    setLoading(false);
    setMessage(response.ok ? `${result.products} produtos e ${result.variants} variantes importados/atualizados.` : result.error || "Não foi possível importar o catálogo.");
    if (response.ok) window.setTimeout(() => window.location.reload(), 900);
  }
  return <div className="flex flex-wrap items-center gap-3"><Button type="button" onClick={() => void run()} disabled={loading} variant="outline"><Download className="mr-2 size-4" />{loading ? "A importar…" : "Importar catálogo POPForge"}</Button>{message && <p className="text-sm text-muted-foreground">{message}</p>}</div>;
}
