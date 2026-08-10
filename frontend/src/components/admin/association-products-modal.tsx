"use client";

import { apiRequest, type PaginatedData } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ProductLink = { id_produto: number; codigo?: string; produto?: string; habilitado?: "S" | "N"; vinculado: boolean | number };

export function AssociationProductsModal({ title, associationLabel, endpoint, onClose }: { title: string; associationLabel: string; endpoint: string; onClose: () => void }) {
  const [items, setItems] = useState<ProductLink[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const hasMore = items.length < total || (page === 1 && total === 0);

  useEffect(() => setMounted(true), []);
  useEffect(() => { const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300); return () => window.clearTimeout(timer); }, [searchInput]);
  useEffect(() => { setItems([]); setTotal(0); setPage(1); }, [endpoint, search]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true); setError("");
    apiRequest<PaginatedData<ProductLink>>(endpoint, { query: { page, limit: 30, search } })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setTotal(result.total);
        setItems((current) => page === 1 ? result.items : [...current, ...result.items.filter((next) => !current.some((item) => item.id_produto === next.id_produto))]);
      })
      .catch((err) => requestId === requestIdRef.current && setError(err instanceof Error ? err.message : "Falha ao carregar produtos"))
      .finally(() => requestId === requestIdRef.current && setLoading(false));
  }, [endpoint, page, search]);

  const loadMore = useCallback(() => { if (!loading && items.length < total) setPage((value) => value + 1); }, [items.length, loading, total]);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), { rootMargin: "180px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => { const close = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [onClose]);

  async function toggleProduct(product: ProductLink) {
    const linked = Boolean(product.vinculado);
    setSavingIds((current) => new Set(current).add(product.id_produto)); setError("");
    try {
      await apiRequest(linked ? `${endpoint}/${product.id_produto}` : endpoint, linked ? { method: "DELETE" } : { method: "POST", body: JSON.stringify({ id_produto: product.id_produto }) });
      setItems((current) => current.map((item) => item.id_produto === product.id_produto ? { ...item, vinculado: !linked } : item));
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao alterar vínculo"); }
    finally { setSavingIds((current) => { const next = new Set(current); next.delete(product.id_produto); return next; }); }
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2 dark:bg-gray-dark" role="dialog" aria-modal="true" aria-labelledby="association-products-title">
        <header className="border-b border-stroke p-5 dark:border-dark-3"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-dark dark:text-white" id="association-products-title">{title}</h2><p className="mt-1 text-sm text-dark-4">Produtos vinculados aparecem primeiro. Use o toggle para adicionar ou remover.</p></div><button className="rounded-md border border-stroke px-3 py-2 text-sm font-bold dark:border-dark-3" onClick={onClose}>Fechar</button></div>
          <input className="mt-4 w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white" onChange={(event) => setSearchInput(event.target.value)} placeholder="Pesquisar por ID, código ou produto" type="search" value={searchInput} />
        </header>
        {error && <div className="m-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-gray-dark"><tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3"><th className="px-5 py-3">Código</th><th className="px-5 py-3">Produto</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">{associationLabel}</th></tr></thead><tbody>
          {items.map((product) => { const linked = Boolean(product.vinculado); return <tr className="border-b border-stroke dark:border-dark-3" key={product.id_produto}><td className="px-5 py-3 text-dark-4">{product.codigo || product.id_produto}</td><td className="px-5 py-3 font-medium text-dark dark:text-white">{product.produto || `Produto #${product.id_produto}`}</td><td className="px-5 py-3">{product.habilitado === "S" ? "Ativo" : "Inativo"}</td><td className="px-5 py-3 text-right"><button aria-checked={linked} aria-label={`${linked ? "Remover" : "Adicionar"} ${product.produto || "produto"}`} className={`relative h-7 w-12 rounded-full transition ${linked ? "bg-primary" : "bg-gray-4 dark:bg-dark-3"} disabled:opacity-50`} disabled={savingIds.has(product.id_produto)} onClick={() => toggleProduct(product)} role="switch"><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${linked ? "left-6" : "left-1"}`} /></button></td></tr>; })}
          {!items.length && !loading && <tr><td className="px-5 py-8 text-center" colSpan={4}>Nenhum produto encontrado.</td></tr>}
        </tbody></table><div className="p-4 text-center text-sm text-dark-4" ref={sentinelRef}>{loading ? "Carregando produtos..." : hasMore ? "Role para carregar mais" : items.length ? "Todos os produtos foram carregados" : ""}</div></div>
        <footer className="border-t border-stroke p-4 text-sm text-dark-4 dark:border-dark-3">{items.length} de {total} produtos carregados</footer>
      </section>
    </div>, document.body);
}
