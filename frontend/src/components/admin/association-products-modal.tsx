"use client";

import { apiRequest, type PaginatedData } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ProductLink = { id_produto: number; codigo?: string; produto?: string; habilitado?: "S" | "N"; vinculado: boolean | number };
type BatchLinkResult = { requested: number; added: number; already_linked: number };
type BatchUnlinkResult = { matched: number; removed: number };

export function AssociationProductsModal({ title, associationLabel, endpoint, listEndpoint = endpoint, onClose }: { title: string; associationLabel: string; endpoint: string; listEndpoint?: string; onClose: () => void }) {
  const [items, setItems] = useState<ProductLink[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const [search, setSearch] = useState("");
  const [exclude, setExclude] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [allResultsSelected, setAllResultsSelected] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [processingBatch, setProcessingBatch] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const hasMore = items.length < total || (page === 1 && total === 0);
  const selectedCount = allResultsSelected
    ? Math.max(0, total - excludedIds.size)
    : selectedIds.size;
  const allResultsFullySelected = allResultsSelected && excludedIds.size === 0 && total > 0;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setExclude(excludeInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [excludeInput, searchInput]);
  useEffect(() => {
    setItems([]);
    setTotal(0);
    setPage(1);
    setSelectedIds(new Set());
    setAllResultsSelected(false);
    setExcludedIds(new Set());
    setMessage("");
  }, [listEndpoint, exclude, search]);

  const loadProducts = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<PaginatedData<ProductLink>>(listEndpoint, { query: { page, limit: 30, search, exclude } });
      if (requestId !== requestIdRef.current) return;
      setTotal(result.total);
      setItems((current) => page === 1 ? result.items : [...current, ...result.items.filter((next) => !current.some((item) => item.id_produto === next.id_produto))]);
    } catch (err) {
      if (requestId === requestIdRef.current) setError(err instanceof Error ? err.message : "Falha ao carregar produtos");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [listEndpoint, exclude, page, search]);
  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        (allResultsSelected && excludedIds.size > 0) ||
        (!allResultsSelected && selectedIds.size > 0);
    }
  }, [allResultsSelected, excludedIds.size, selectedIds.size]);

  const loadMore = useCallback(() => { if (!loading && items.length < total) setPage((value) => value + 1); }, [items.length, loading, total]);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), { rootMargin: "180px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  function toggleSelection(productId: number) {
    if (allResultsSelected) {
      setExcludedIds((current) => {
        const next = new Set(current);
        if (next.has(productId)) next.delete(productId); else next.add(productId);
        return next;
      });
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  }

  function toggleAllResults() {
    if (allResultsFullySelected) {
      setAllResultsSelected(false);
      setSelectedIds(new Set());
    } else {
      setAllResultsSelected(true);
      setSelectedIds(new Set());
    }
    setExcludedIds(new Set());
  }

  function isSelected(productId: number) {
    return allResultsSelected ? !excludedIds.has(productId) : selectedIds.has(productId);
  }

  async function toggleProduct(product: ProductLink) {
    const linked = Boolean(product.vinculado);
    setSavingIds((current) => new Set(current).add(product.id_produto));
    setError(""); setMessage("");
    try {
      await apiRequest(linked ? `${endpoint}/${product.id_produto}` : endpoint, { method: linked ? "DELETE" : "POST", ...(linked ? {} : { body: JSON.stringify({ id_produto: product.id_produto }) }) });
      setItems((current) => current.map((item) => item.id_produto === product.id_produto ? { ...item, vinculado: !linked } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao alterar vinculo");
    } finally {
      setSavingIds((current) => { const next = new Set(current); next.delete(product.id_produto); return next; });
    }
  }

  async function addSelected() {
    if (!selectedCount) return;
    const produtoIds = [...selectedIds];
    const omittedIds = [...excludedIds];
    setProcessingBatch(true); setError(""); setMessage("");
    try {
      const body = allResultsSelected
        ? { select_all: true, search, exclude, excluded_ids: omittedIds }
        : { produto_ids: produtoIds };
      const result = await apiRequest<BatchLinkResult>(`${endpoint}/lote`, { method: "POST", body: JSON.stringify(body) });
      const processed = new Set(produtoIds);
      const omitted = new Set(omittedIds);
      setItems((current) => current.map((item) => {
        const wasProcessed = allResultsSelected ? !omitted.has(item.id_produto) : processed.has(item.id_produto);
        return wasProcessed ? { ...item, vinculado: true } : item;
      }));
      setSelectedIds(new Set());
      setAllResultsSelected(false);
      setExcludedIds(new Set());
      setMessage(`${result.added} produto(s) adicionado(s); ${result.already_linked} já estava(m) vinculado(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao adicionar produtos em lote");
    } finally { setProcessingBatch(false); }
  }

  async function unlinkFiltered() {
    setProcessingBatch(true); setError(""); setMessage("");
    try {
      const result = await apiRequest<BatchUnlinkResult>(endpoint, { method: "DELETE", query: { search, exclude } });
      setItems((current) => current.map((item) => ({ ...item, vinculado: false })));
      setSelectedIds(new Set());
      setAllResultsSelected(false);
      setExcludedIds(new Set());
      setMessage(`${result.removed} de ${result.matched} vinculo(s) encontrado(s) foram removidos.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desvincular produtos");
    } finally { setProcessingBatch(false); }
  }

  if (!mounted) return null;
  const hasFilters = Boolean(search || exclude);
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="association-products-title" aria-modal="true" className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2 dark:bg-gray-dark" role="dialog">
        <header className="border-b border-stroke p-5 dark:border-dark-3">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-xl font-bold text-dark dark:text-white" id="association-products-title">{title}</h2><p className="mt-1 text-sm text-dark-4">Pesquise, selecione produtos ou altere vínculos individualmente.</p></div>
            <button className="rounded-md border border-stroke px-3 py-2 text-sm font-bold dark:border-dark-3" onClick={onClose}>Fechar</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label><span className="mb-1 block text-xs font-bold uppercase text-dark-4">Buscar</span><input aria-label="Buscar por ID, código ou produto" className="w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white" onChange={(event) => setSearchInput(event.target.value)} placeholder="ID, código ou produto" type="search" value={searchInput} /></label>
            <label><span className="mb-1 block text-xs font-bold uppercase text-dark-4">Não conter</span><input aria-label="Termos que o nome do produto não deve conter" className="w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white" maxLength={500} onChange={(event) => setExcludeInput(event.target.value)} placeholder="Ex.: anotações, caneta" type="search" value={excludeInput} /><span className="mt-1 block text-xs text-dark-4">Separe vários termos por vírgula.</span></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={!selectedCount || processingBatch} onClick={addSelected} type="button">{processingBatch ? "Processando..." : `Adicionar selecionados (${selectedCount})`}</button>
            <button className="rounded-md border border-red-300 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50" disabled={processingBatch} onClick={unlinkFiltered} type="button">{hasFilters ? "Desvincular encontrados" : "Desvincular todos"}</button>
          </div>
        </header>
        {error && <div className="mx-4 mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {message && <div className="mx-4 mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>}
        <div className="overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white dark:bg-gray-dark"><tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3"><th className="w-12 px-5 py-3"><input aria-label="Selecionar todos os produtos encontrados" checked={allResultsFullySelected} disabled={!total} onChange={toggleAllResults} ref={selectAllRef} type="checkbox" /></th><th className="px-5 py-3">Código</th><th className="px-5 py-3">Produto</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">{associationLabel}</th></tr></thead>
          <tbody>{items.map((product) => { const linked = Boolean(product.vinculado); return <tr className="border-b border-stroke dark:border-dark-3" key={product.id_produto}><td className="px-5 py-3"><input aria-label={`Selecionar ${product.produto || `produto ${product.id_produto}`}`} checked={isSelected(product.id_produto)} onChange={() => toggleSelection(product.id_produto)} type="checkbox" /></td><td className="px-5 py-3 text-dark-4">{product.codigo || product.id_produto}</td><td className="px-5 py-3 font-medium text-dark dark:text-white">{product.produto || `Produto #${product.id_produto}`}</td><td className="px-5 py-3">{product.habilitado === "S" ? "Ativo" : "Inativo"}</td><td className="px-5 py-3 text-right"><button aria-checked={linked} aria-label={`${linked ? "Remover" : "Adicionar"} ${product.produto || "produto"}`} className={`relative h-7 w-12 rounded-full transition ${linked ? "bg-primary" : "bg-gray-4 dark:bg-dark-3"} disabled:opacity-50`} disabled={savingIds.has(product.id_produto) || processingBatch} onClick={() => toggleProduct(product)} role="switch" type="button"><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${linked ? "left-6" : "left-1"}`} /></button></td></tr>; })}
          {!items.length && !loading && <tr><td className="px-5 py-8 text-center" colSpan={5}>Nenhum produto encontrado.</td></tr>}</tbody></table>
          <div className="p-4 text-center text-sm text-dark-4" ref={sentinelRef}>{loading ? "Carregando produtos..." : hasMore ? "Role para carregar mais" : items.length ? "Todos os produtos foram carregados" : ""}</div>
        </div>
        <footer className="border-t border-stroke p-4 text-sm text-dark-4 dark:border-dark-3">{items.length} de {total} produtos carregados; {selectedCount} selecionado(s){allResultsSelected ? " em todo o resultado" : ""}</footer>
      </section>
    </div>, document.body,
  );
}
