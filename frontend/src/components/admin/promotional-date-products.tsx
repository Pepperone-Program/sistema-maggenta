"use client";

import { apiRequest, listResource, type PaginatedData } from "@/lib/api";
import { useEffect, useState } from "react";

type PromotionalDate = {
  id_data_promocional: number;
  data_promocional: string;
  data: string | null;
};

type ProductLink = {
  id_produto: number;
  codigo?: string;
  produto?: string;
  habilitado?: "S" | "N";
  vinculado: boolean | number;
};

export function PromotionalDateProducts() {
  const [dates, setDates] = useState<PromotionalDate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [products, setProducts] = useState<PaginatedData<ProductLink> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    listResource<PromotionalDate>("/api/v1/datas-promocionais", { limit: 100 })
      .then((result) => {
        setDates(result.items);
        setSelectedId((current) => current || String(result.items[0]?.id_data_promocional || ""));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar datas"));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setProducts(null);
      return;
    }
    setLoading(true);
    setError("");
    apiRequest<PaginatedData<ProductLink>>(`/api/v1/datas-promocionais/${selectedId}/produtos`, {
      query: { page, limit: 100 },
    })
      .then(setProducts)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar produtos"))
      .finally(() => setLoading(false));
  }, [selectedId, page]);

  async function toggleProduct(product: ProductLink) {
    const linked = Boolean(product.vinculado);
    setSavingIds((current) => new Set(current).add(product.id_produto));
    setError("");
    try {
      await apiRequest(
        linked
          ? `/api/v1/datas-promocionais/${selectedId}/produtos/${product.id_produto}`
          : `/api/v1/datas-promocionais/${selectedId}/produtos`,
        linked
          ? { method: "DELETE" }
          : { method: "POST", body: JSON.stringify({ id_produto: product.id_produto }) },
      );
      setProducts((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id_produto === product.id_produto ? { ...item, vinculado: !linked } : item,
              ),
            }
          : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao alterar vinculo");
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(product.id_produto);
        return next;
      });
    }
  }

  return (
    <section className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
      <div className="border-b border-stroke p-5 dark:border-dark-3">
        <h2 className="text-xl font-bold text-dark dark:text-white">Produtos por data promocional</h2>
        <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
          Selecione uma data e ative ou remova o vínculo de cada produto.
        </p>
        <select
          className="mt-4 w-full max-w-xl rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
          onChange={(event) => { setSelectedId(event.target.value); setPage(1); }}
          value={selectedId}
        >
          {!dates.length && <option value="">Nenhuma data promocional cadastrada</option>}
          {dates.map((date) => (
            <option key={date.id_data_promocional} value={date.id_data_promocional}>
              {date.data_promocional}{date.data ? ` — ${String(date.data).slice(0, 10)}` : ""}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="m-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3">
            <th className="px-5 py-3">Código</th><th className="px-5 py-3">Produto</th>
            <th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Vínculo</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td className="px-5 py-8 text-center text-dark-4" colSpan={4}>Carregando produtos...</td></tr>
            ) : products?.items.length ? products.items.map((product) => {
              const linked = Boolean(product.vinculado);
              const saving = savingIds.has(product.id_produto);
              return <tr className="border-b border-stroke dark:border-dark-3" key={product.id_produto}>
                <td className="px-5 py-3 text-dark-4">{product.codigo || product.id_produto}</td>
                <td className="px-5 py-3 font-medium text-dark dark:text-white">{product.produto || `Produto #${product.id_produto}`}</td>
                <td className="px-5 py-3">{product.habilitado === "S" ? "Ativo" : "Inativo"}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    aria-checked={linked}
                    className={`relative h-7 w-12 rounded-full transition ${linked ? "bg-primary" : "bg-gray-4 dark:bg-dark-3"} disabled:opacity-50`}
                    disabled={saving}
                    onClick={() => toggleProduct(product)}
                    role="switch"
                    type="button"
                  ><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${linked ? "left-6" : "left-1"}`} /></button>
                </td>
              </tr>;
            }) : (
              <tr><td className="px-5 py-8 text-center text-dark-4" colSpan={4}>Nenhum produto encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-stroke p-4 text-sm dark:border-dark-3">
        <span className="text-dark-4">{products ? `${products.total} produtos` : ""}</span>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-stroke px-3 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>{page} / {products?.totalPages || 1}</span>
          <button className="rounded-md border border-stroke px-3 py-2 disabled:opacity-40" disabled={!products || page >= products.totalPages} onClick={() => setPage(page + 1)}>Próxima</button>
        </div>
      </div>
    </section>
  );
}
