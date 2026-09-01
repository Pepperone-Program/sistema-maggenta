"use client";

import { apiRequest, type PaginatedData } from "@/lib/api";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProductImage = {
  id_imagem: number;
  url_imagem: string;
  ordem_imagem: number;
};

type Product = {
  id_produto: number;
  codigo: string | null;
  produto: string;
  descricao: string | null;
  altura: string | null;
  largura: string | null;
  profundidade: string | null;
  imagens?: ProductImage[];
};

type GeneratedDescription = {
  id_produto: number;
  codigo: string;
  titulo_anterior: string;
  descricao_anterior: string;
  titulo: string;
  descricao: string;
  imagens_consideradas: number;
  modelo: string;
  response_id: string | null;
};

type ProductRun = {
  status: "waiting" | "generating" | "success" | "error";
  result?: GeneratedDescription;
  error?: string;
};

const MAX_SELECTION = 50;
const APP_CONCURRENCY = 3;

function firstImage(product: Product): string | null {
  const ordered = [...(product.imagens || [])].sort(
    (a, b) => Number(a.ordem_imagem) - Number(b.ordem_imagem),
  );
  return ordered[0]?.url_imagem || null;
}

function ProductThumb({ product, size = "normal" }: { product: Product; size?: "normal" | "large" }) {
  const image = firstImage(product);
  const sizing = size === "large" ? "h-24 w-24" : "h-12 w-12";

  if (!image) {
    return (
      <div
        aria-hidden="true"
        className={`${sizing} grid shrink-0 place-items-center rounded-lg bg-violet-50 text-xs font-bold text-primary dark:bg-primary/10`}
      >
        #{product.id_produto}
      </div>
    );
  }

  return (
    // URLs são cadastradas e exibidas pelo próprio catálogo administrativo.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className={`${sizing} shrink-0 rounded-lg border border-stroke object-cover dark:border-dark-3`}
      src={image}
    />
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
      <path d="M12 2.75c.62 4.7 2.55 6.63 7.25 7.25-4.7.62-6.63 2.55-7.25 7.25C11.38 12.55 9.45 10.62 4.75 10 9.45 9.38 11.38 7.45 12 2.75Z" fill="currentColor" />
      <path d="M19 15.5c.27 2.03 1.1 2.86 3.13 3.13-2.03.27-2.86 1.1-3.13 3.12-.27-2.02-1.1-2.85-3.13-3.12 2.03-.27 2.86-1.1 3.13-3.13ZM4.5 2c.2 1.52.83 2.15 2.35 2.35C5.33 4.55 4.7 5.18 4.5 6.7 4.3 5.18 3.67 4.55 2.15 4.35 3.67 4.15 4.3 3.52 4.5 2Z" fill="currentColor" />
    </svg>
  );
}

function statusLabel(run?: ProductRun) {
  if (!run) return "Pronto para gerar";
  if (run.status === "waiting") return "Na fila";
  if (run.status === "generating") return "Gerando descrição";
  if (run.status === "success") return "Descrição salva";
  return "Falha na geração";
}

export function AiProductDescriptionsPage() {
  const [selectionMode, setSelectionMode] = useState<"single" | "multiple">("multiple");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product[]>([]);
  const [runs, setRuns] = useState<Record<number, ProductRun>>({});
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [pageError, setPageError] = useState("");
  const searchRequest = useRef(0);
  const selectorRef = useClickOutside<HTMLDivElement>(() => setOpen(false));

  useEffect(() => {
    const requestId = searchRequest.current + 1;
    searchRequest.current = requestId;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await apiRequest<PaginatedData<Product>>("/api/v1/produtos", {
          query: { page: 1, limit: 20, search: query.trim() || undefined, order: "DESC" },
        });
        if (searchRequest.current === requestId) setOptions(response.items);
      } catch (error) {
        if (searchRequest.current === requestId) {
          setPageError(error instanceof Error ? error.message : "Falha ao buscar produtos");
        }
      } finally {
        if (searchRequest.current === requestId) setSearching(false);
      }
    }, query ? 300 : 0);

    return () => window.clearTimeout(timer);
  }, [query]);

  const selectedIds = useMemo(() => new Set(selected.map((product) => product.id_produto)), [selected]);
  const completed = selected.filter((product) => runs[product.id_produto]?.status === "success").length;
  const failed = selected.filter((product) => runs[product.id_produto]?.status === "error").length;
  const progress = selected.length ? Math.round(((completed + failed) / selected.length) * 100) : 0;

  function chooseProduct(product: Product) {
    setPageError("");
    setSelected((current) => {
      if (selectionMode === "single") return [product];
      if (current.some((item) => item.id_produto === product.id_produto)) return current;
      if (current.length >= MAX_SELECTION) {
        setPageError(`Selecione no máximo ${MAX_SELECTION} produtos por execução.`);
        return current;
      }
      return [...current, product];
    });
    if (selectionMode === "single") {
      setRuns({});
    }
    setQuery("");
    setOpen(false);
  }

  function removeProduct(productId: number) {
    if (running) return;
    setSelected((current) => current.filter((product) => product.id_produto !== productId));
    setRuns((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  const generate = useCallback(async (products: Product[]) => {
    if (!products.length || running) return;
    setRunning(true);
    setPageError("");
    setRuns((current) => {
      const next = { ...current };
      products.forEach((product) => {
        next[product.id_produto] = { status: "waiting" };
      });
      return next;
    });

    let nextIndex = 0;
    const worker = async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= products.length) return;
        const product = products[index];
        setRuns((current) => ({
          ...current,
          [product.id_produto]: { status: "generating" },
        }));
        try {
          const result = await apiRequest<GeneratedDescription>(
            `/api/v1/produtos/${product.id_produto}/gerar-descricao`,
            { method: "POST", body: JSON.stringify({}) },
          );
          setRuns((current) => ({
            ...current,
            [product.id_produto]: { status: "success", result },
          }));
        } catch (error) {
          setRuns((current) => ({
            ...current,
            [product.id_produto]: {
              status: "error",
              error: error instanceof Error ? error.message : "Falha ao gerar descrição",
            },
          }));
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(APP_CONCURRENCY, products.length) }, worker));
    setRunning(false);
  }, [running]);

  function changeMode(mode: "single" | "multiple") {
    if (running) return;
    setSelectionMode(mode);
    setRuns({});
    setSelected((current) => (mode === "single" ? current.slice(0, 1) : current));
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl bg-white shadow-1 dark:bg-gray-dark">
        <div className="relative border-b border-stroke px-5 py-6 dark:border-dark-3 sm:px-7">
          <div aria-hidden="true" className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.14),transparent_68%)]" />
          <div className="relative flex max-w-3xl items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-[0_8px_24px_rgba(124,58,237,0.28)]">
              <SparkIcon />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Catálogo Maggenta</p>
              <h1 className="mt-2 text-2xl font-bold text-dark dark:text-white sm:text-3xl">Descrições com IA</h1>
              <p className="mt-2 text-sm leading-6 text-dark-4 dark:text-dark-6">
                Enriqueça nome e descrição usando os dados técnicos e as fotos já cadastradas. Cada resultado é salvo diretamente no produto.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <label className="text-sm font-bold text-dark dark:text-white" htmlFor="product-search">Selecionar produtos</label>
              <div className="inline-flex rounded-lg bg-gray-2 p-1 dark:bg-dark-2" role="group" aria-label="Modo de seleção">
                <button
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${selectionMode === "single" ? "bg-white text-primary shadow-sm dark:bg-dark-3" : "text-dark-4 dark:text-dark-6"}`}
                  disabled={running}
                  onClick={() => changeMode("single")}
                  type="button"
                >
                  Único
                </button>
                <button
                  className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${selectionMode === "multiple" ? "bg-white text-primary shadow-sm dark:bg-dark-3" : "text-dark-4 dark:text-dark-6"}`}
                  disabled={running}
                  onClick={() => changeMode("multiple")}
                  type="button"
                >
                  Múltiplos
                </button>
              </div>
            </div>

            <div className="relative" ref={selectorRef}>
              <input
                aria-autocomplete="list"
                aria-controls="product-options"
                aria-expanded={open}
                autoComplete="off"
                className="w-full rounded-lg border border-stroke bg-gray-2 px-4 py-3.5 pr-28 text-sm text-dark outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:focus:bg-dark-2"
                disabled={running}
                id="product-search"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOpen(false);
                }}
                placeholder="Buscar por ID, código ou nome"
                role="combobox"
                value={query}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-dark-4 dark:text-dark-6">
                {searching ? "Buscando..." : `${selected.length} selecionado${selected.length === 1 ? "" : "s"}`}
              </span>

              {open && (
                <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-stroke bg-white p-2 shadow-2 dark:border-dark-3 dark:bg-gray-dark" id="product-options" role="listbox" aria-multiselectable={selectionMode === "multiple"}>
                  {options.length ? options.map((product) => {
                    const isSelected = selectedIds.has(product.id_produto);
                    return (
                      <button
                        aria-selected={isSelected}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-violet-50 focus:bg-violet-50 focus:outline-none dark:hover:bg-primary/10 dark:focus:bg-primary/10 disabled:opacity-50"
                        disabled={isSelected}
                        key={product.id_produto}
                        onClick={() => chooseProduct(product)}
                        role="option"
                        type="button"
                      >
                        <ProductThumb product={product} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-dark dark:text-white">{product.produto}</span>
                          <span className="mt-1 block truncate text-xs text-dark-4 dark:text-dark-6">#{product.id_produto} · {product.codigo || "Sem código"}</span>
                        </span>
                        {isSelected && <span className="text-xs font-bold text-primary">Selecionado</span>}
                      </button>
                    );
                  }) : (
                    <p className="px-3 py-8 text-center text-sm text-dark-4 dark:text-dark-6">Nenhum produto encontrado.</p>
                  )}
                </div>
              )}
            </div>

            {selected.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.map((product) => (
                  <button
                    className="group inline-flex max-w-full items-center gap-2 rounded-full border border-stroke bg-white py-1.5 pl-3 pr-2 text-xs font-semibold text-dark transition hover:border-red-300 dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                    disabled={running}
                    key={product.id_produto}
                    onClick={() => removeProduct(product.id_produto)}
                    title="Remover da seleção"
                    type="button"
                  >
                    <span className="truncate">#{product.id_produto} {product.produto}</span>
                    <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full bg-gray-2 text-sm group-hover:bg-red-50 group-hover:text-red-600 dark:bg-dark-3">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="rounded-xl border border-violet-100 bg-violet-50/70 p-5 dark:border-primary/20 dark:bg-primary/10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Antes de gerar</p>
            <ul className="mt-4 space-y-3 text-sm leading-5 text-dark-4 dark:text-dark-6">
              <li className="flex gap-2"><span className="font-bold text-primary">01</span><span>Nome, descrição, observações e medidas formam a base factual.</span></li>
              <li className="flex gap-2"><span className="font-bold text-primary">02</span><span>Até três fotos ajudam a reconhecer aspectos visuais, sem inventar dados técnicos.</span></li>
              <li className="flex gap-2"><span className="font-bold text-primary">03</span><span>O novo título e a descrição são validados e salvos no cadastro.</span></li>
            </ul>
          </aside>
        </div>

        <div className="flex flex-col gap-4 border-t border-stroke bg-gray-2/60 px-5 py-4 dark:border-dark-3 dark:bg-dark-2/60 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs font-semibold text-dark-4 dark:text-dark-6">
              <span>{running ? `${completed + failed} de ${selected.length} processados` : selected.length ? `${selected.length} produto${selected.length === 1 ? "" : "s"} pronto${selected.length === 1 ? "" : "s"}` : "Selecione ao menos um produto"}</span>
              {(running || completed + failed > 0) && <span>{progress}%</span>}
            </div>
            {(running || completed + failed > 0) && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-100 dark:bg-dark-3">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(124,58,237,0.22)] transition hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!selected.length || running}
            onClick={() => generate(selected)}
            type="button"
          >
            <SparkIcon />
            {running ? "Gerando descrições..." : "Gerar descrição"}
          </button>
        </div>
      </section>

      {pageError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{pageError}</div>}

      {selected.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-dark dark:text-white">Fila de produtos</h2>
              <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">Acompanhe cada item e compare o conteúdo anterior com o resultado salvo.</p>
            </div>
            {failed > 0 && !running && (
              <button
                className="rounded-lg border border-primary px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5"
                onClick={() => generate(selected.filter((product) => runs[product.id_produto]?.status === "error"))}
                type="button"
              >
                Tentar falhas novamente
              </button>
            )}
          </div>

          <div className="space-y-3">
            {selected.map((product) => {
              const run = runs[product.id_produto];
              const result = run?.result;
              return (
                <article className="rounded-xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark sm:p-5" key={product.id_produto}>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <ProductThumb product={product} size="large" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-primary">#{product.id_produto} · {product.codigo || "Sem código"}</p>
                          <h3 className="mt-1 truncate text-base font-bold text-dark dark:text-white">{result?.titulo || product.produto}</h3>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${run?.status === "success" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : run?.status === "error" ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" : run?.status === "generating" ? "animate-pulse bg-violet-50 text-primary dark:bg-primary/10" : "bg-gray-2 text-dark-4 dark:bg-dark-2 dark:text-dark-6"}`}>
                          {statusLabel(run)}
                        </span>
                      </div>

                      {run?.status === "error" && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{run.error}</p>}

                      {result && (
                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          <div className="rounded-lg bg-gray-2 p-4 dark:bg-dark-2">
                            <p className="text-xs font-bold uppercase tracking-wide text-dark-4 dark:text-dark-6">Conteúdo anterior</p>
                            <p className="mt-2 text-sm font-bold text-dark dark:text-white">{result.titulo_anterior}</p>
                            <p className="mt-2 line-clamp-5 text-sm leading-6 text-dark-4 dark:text-dark-6">{result.descricao_anterior || "Sem descrição anterior."}</p>
                          </div>
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Resultado salvo</p>
                            <p className="mt-2 text-sm font-bold text-dark dark:text-white">{result.titulo}</p>
                            <p className="mt-2 text-sm leading-6 text-dark-4 dark:text-dark-6">{result.descricao}</p>
                            <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{result.imagens_consideradas} foto{result.imagens_consideradas === 1 ? "" : "s"} considerada{result.imagens_consideradas === 1 ? "" : "s"}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
