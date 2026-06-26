"use client";

import { apiRequest } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;

type Product = {
  id_produto: number;
  produto?: string | null;
  codigo?: string | null;
};

type ProductSubcategory = {
  id_empresa: number;
  id_subcategoria: number;
  id_categoria: number;
  subcategoria: string;
  categoria?: string | null;
  habilitado?: string | null;
  id_empresa_vinculo?: number | null;
  id_produto: number | null;
  vinculado: number | boolean;
};

function text(value: unknown) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function productLabel(product: Product) {
  const code = product.codigo ? `${product.codigo} - ` : "";
  return `${code}${product.produto || `Produto #${product.id_produto}`}`;
}

export function ProductSubcategoriesPage() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [subcategories, setSubcategories] = useState<ProductSubcategory[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setLoadingProducts(true);
      try {
        const response = await apiRequest<{ items: Product[] }>("/api/v1/produtos", {
          query: { search, limit: 12 },
        });
        setProducts(response.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao buscar produtos");
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  async function loadSubcategories(productId: number) {
    setLoadingSubcategories(true);
    setError("");
    try {
      const response = await apiRequest<ProductSubcategory[]>(
        `/api/v1/produtos/${productId}/subcategorias`,
      );
      setSubcategories(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar subcategorias");
      setSubcategories([]);
    } finally {
      setLoadingSubcategories(false);
    }
  }

  async function selectProduct(product: Product) {
    setSelectedProduct(product);
    setSearch("");
    setMessage("");
    await loadSubcategories(product.id_produto);
  }

  async function toggleSubcategory(item: ProductSubcategory, checked: boolean) {
    if (!selectedProduct) return;

    setSavingId(item.id_subcategoria);
    setError("");
    setMessage("");

    try {
      await apiRequest(
        `/api/v1/produtos/${selectedProduct.id_produto}/subcategorias/${item.id_subcategoria}${
          !checked && item.id_empresa_vinculo
            ? `?empresaId=${encodeURIComponent(String(item.id_empresa_vinculo))}`
            : ""
        }`,
        { method: checked ? "POST" : "DELETE" },
      );
      await loadSubcategories(selectedProduct.id_produto);
      setMessage(checked ? "Subcategoria vinculada." : "Subcategoria removida.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar vinculo");
    } finally {
      setSavingId(null);
    }
  }

  const linkedCount = useMemo(
    () => subcategories.filter((item) => Boolean(item.vinculado)).length,
    [subcategories],
  );

  const groupedSubcategories = useMemo(() => {
    return subcategories.reduce<Record<string, ProductSubcategory[]>>((acc, item) => {
      const key = text(item.categoria);
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [subcategories]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Catalogo
        </p>
        <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">
          Subcategorias por produto
        </h1>
        <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
          Marque as subcategorias vinculadas ao produto selecionado.
        </p>
      </div>

      {(error || message) && (
        <div
          className={
            error
              ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              : "rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700"
          }
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
          <h2 className="text-lg font-bold text-dark dark:text-white">Produto</h2>
          <input
            className="mt-4 w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedProduct(null);
              setSubcategories([]);
            }}
            placeholder="Buscar produto por nome ou codigo"
            value={selectedProduct ? productLabel(selectedProduct) : search}
          />

          <div className="mt-3 max-h-[520px] overflow-y-auto rounded-md border border-stroke bg-white dark:border-dark-3 dark:bg-dark-2">
            {loadingProducts ? (
              <div className="px-4 py-3 text-sm text-dark-4">Buscando...</div>
            ) : products.length ? (
              products.map((product) => (
                <button
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-gray-2 dark:hover:bg-dark-3"
                  key={product.id_produto}
                  onClick={() => selectProduct(product).catch((err) => setError(err instanceof Error ? err.message : "Falha ao selecionar produto"))}
                  type="button"
                >
                  <span className="font-semibold text-dark dark:text-white">
                    {productLabel(product)}
                  </span>
                  <span className="shrink-0 text-xs text-dark-4">#{product.id_produto}</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-dark-4">Nenhum produto encontrado.</div>
            )}
          </div>
        </section>

        <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-dark dark:text-white">
                {selectedProduct ? productLabel(selectedProduct) : "Selecione um produto"}
              </h2>
              <p className="text-sm text-dark-4 dark:text-dark-6">
                {selectedProduct ? `${linkedCount} subcategoria(s) vinculada(s)` : "As opcoes aparecem depois da selecao."}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            {loadingSubcategories ? (
              <div className="rounded-md bg-gray-2 px-4 py-8 text-center text-sm text-dark-4 dark:bg-dark-2">
                Carregando subcategorias...
              </div>
            ) : selectedProduct && subcategories.length ? (
              Object.entries(groupedSubcategories).map(([categoria, items]) => (
                <div className="rounded-md border border-stroke p-4 dark:border-dark-3" key={categoria}>
                  <h3 className="mb-3 text-sm font-bold text-dark dark:text-white">{categoria}</h3>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((item) => {
                      const checked = Boolean(item.vinculado);
                      const disabled = savingId === item.id_subcategoria;

                      return (
                        <label
                          className="flex min-h-12 items-center gap-3 rounded-md bg-gray-2 px-3 py-2 text-sm font-semibold text-dark dark:bg-dark-2 dark:text-white"
                          key={item.id_subcategoria}
                        >
                          <input
                            checked={checked}
                            className="h-4 w-4 accent-primary"
                            disabled={disabled}
                            onChange={(event) => toggleSubcategory(item, event.target.checked)}
                            type="checkbox"
                          />
                          <span className="min-w-0 flex-1 truncate">{item.subcategoria}</span>
                          <span className="text-xs text-dark-4">#{item.id_subcategoria}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md bg-gray-2 px-4 py-8 text-center text-sm text-dark-4 dark:bg-dark-2">
                {selectedProduct ? "Nenhuma subcategoria cadastrada." : "Escolha um produto para editar os vinculos."}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
