"use client";

import { apiRequest, type PaginatedData } from "@/lib/api";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type PromotionalDate = { id_data_promocional: number; data_promocional: string; data: string | null };
type ProductLink = { id_produto: number; codigo?: string; produto?: string; habilitado?: "S" | "N"; vinculado: boolean | number };

export function PromotionalDateProducts({ date, onClose }: { date: PromotionalDate; onClose: () => void }) {
  const [products, setProducts] = useState<PaginatedData<ProductLink> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setLoading(true); setError("");
    apiRequest<PaginatedData<ProductLink>>(`/api/v1/datas-promocionais/${date.id_data_promocional}/produtos`, { query: { page, limit: 100 } })
      .then(setProducts)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar produtos"))
      .finally(() => setLoading(false));
  }, [date.id_data_promocional, page]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  async function toggleProduct(product: ProductLink) {
    const linked = Boolean(product.vinculado);
    setSavingIds((current) => new Set(current).add(product.id_produto)); setError("");
    try {
      await apiRequest(linked
        ? `/api/v1/datas-promocionais/${date.id_data_promocional}/produtos/${product.id_produto}`
        : `/api/v1/datas-promocionais/${date.id_data_promocional}/produtos`,
        linked ? { method: "DELETE" } : { method: "POST", body: JSON.stringify({ id_produto: product.id_produto }) });
      setProducts((current) => current ? { ...current, items: current.items.map((item) => item.id_produto === product.id_produto ? { ...item, vinculado: !linked } : item) } : current);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao alterar vínculo"); }
    finally { setSavingIds((current) => { const next = new Set(current); next.delete(product.id_produto); return next; }); }
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2 dark:bg-gray-dark" role="dialog" aria-modal="true" aria-labelledby="promotional-products-title">
        <header className="flex items-start justify-between border-b border-stroke p-5 dark:border-dark-3">
          <div><h2 className="text-xl font-bold text-dark dark:text-white" id="promotional-products-title">{date.data_promocional}</h2><p className="mt-1 text-sm text-dark-4">Ative o toggle para adicionar um produto ou desative para removê-lo desta data.</p></div>
          <button className="rounded-md border border-stroke px-3 py-2 text-sm font-bold dark:border-dark-3" onClick={onClose}>Fechar</button>
        </header>
        {error && <div className="m-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3"><th className="px-5 py-3">Código</th><th className="px-5 py-3">Produto</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Na data</th></tr></thead>
          <tbody>{loading ? <tr><td className="px-5 py-8 text-center" colSpan={4}>Carregando produtos...</td></tr> : products?.items.length ? products.items.map((product) => { const linked = Boolean(product.vinculado); return <tr className="border-b border-stroke dark:border-dark-3" key={product.id_produto}><td className="px-5 py-3 text-dark-4">{product.codigo || product.id_produto}</td><td className="px-5 py-3 font-medium text-dark dark:text-white">{product.produto || `Produto #${product.id_produto}`}</td><td className="px-5 py-3">{product.habilitado === "S" ? "Ativo" : "Inativo"}</td><td className="px-5 py-3 text-right"><button aria-checked={linked} aria-label={`${linked ? "Remover" : "Adicionar"} ${product.produto || "produto"}`} className={`relative h-7 w-12 rounded-full transition ${linked ? "bg-primary" : "bg-gray-4 dark:bg-dark-3"} disabled:opacity-50`} disabled={savingIds.has(product.id_produto)} onClick={() => toggleProduct(product)} role="switch"><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${linked ? "left-6" : "left-1"}`} /></button></td></tr>; }) : <tr><td className="px-5 py-8 text-center" colSpan={4}>Nenhum produto encontrado.</td></tr>}</tbody></table></div>
        <footer className="flex items-center justify-between border-t border-stroke p-4 text-sm dark:border-dark-3"><span>{products ? `${products.total} produtos` : ""}</span><div className="flex items-center gap-2"><button className="rounded-md border px-3 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button><span>{page} / {products?.totalPages || 1}</span><button className="rounded-md border px-3 py-2 disabled:opacity-40" disabled={!products || page >= products.totalPages} onClick={() => setPage((v) => v + 1)}>Próxima</button></div></footer>
      </section>
    </div>, document.body);
}
