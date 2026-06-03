"use client";

import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
  type PaginatedData,
} from "@/lib/api";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "./status-badge";

type Category = Record<string, unknown> & {
  id_categoria?: number;
  categoria?: string;
};

type Subcategory = Record<string, unknown> & {
  id_categoria?: number;
  id_subcategoria?: number;
  subcategoria?: string;
  descricao?: string | null;
  icon?: string | null;
  habilitado?: string | null;
  ordem?: number | null;
};

const defaultSubcategory: Subcategory = {
  habilitado: "S",
  ordem: 0,
};

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function SubcategoryModal({
  categories,
  subcategory,
  onClose,
  onSaved,
}: {
  categories: Category[];
  subcategory: Subcategory | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showCategoryResults, setShowCategoryResults] = useState(false);
  const values = useMemo(
    () => ({ ...defaultSubcategory, ...(subcategory || {}) }),
    [subcategory],
  );
  const subcategoryId = subcategory?.id_subcategoria
    ? Number(subcategory.id_subcategoria)
    : null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const categoryId = values.id_categoria ? Number(values.id_categoria) : null;
    const category = categories.find(
      (item) => Number(item.id_categoria) === categoryId,
    );

    setSelectedCategoryId(categoryId);
    setCategorySearch(category?.categoria ? String(category.categoria) : "");
  }, [categories, values.id_categoria]);

  const filteredCategories = useMemo(() => {
    const term = normalize(categorySearch.trim());
    const list = term
      ? categories.filter((category) =>
          normalize(String(category.categoria || "")).includes(term),
        )
      : categories;

    return list.slice(0, 12);
  }, [categories, categorySearch]);

  function selectCategory(category: Category) {
    setSelectedCategoryId(Number(category.id_categoria));
    setCategorySearch(String(category.categoria || ""));
    setShowCategoryResults(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    if (!selectedCategoryId) {
      setError("Selecione uma categoria pelo nome.");
      setSaving(false);
      return;
    }

    const form = new FormData(event.currentTarget);
    const order = String(form.get("ordem") || "").trim();
    const payload = {
      id_categoria: selectedCategoryId,
      subcategoria: String(form.get("subcategoria") || "").trim(),
      descricao: String(form.get("descricao") || ""),
      icon: String(form.get("icon") || ""),
      habilitado: String(form.get("habilitado") || "N"),
      ordem: order ? Number(order) : 0,
    };

    try {
      if (subcategoryId) {
        await updateResource("/api/v1/subcategorias", subcategoryId, payload);
      } else {
        await createResource("/api/v1/subcategorias", payload);
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar subcategoria");
    } finally {
      setSaving(false);
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <form
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-2 dark:bg-gray-dark"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              {subcategoryId ? `Subcategoria #${subcategoryId}` : "Nova subcategoria"}
            </p>
            <h2 className="mt-1 text-xl font-bold text-dark dark:text-white">
              {subcategoryId ? "Editar subcategoria" : "Cadastrar subcategoria"}
            </h2>
          </div>
          <button className="rounded-md border border-stroke px-3 py-2 text-sm font-semibold dark:border-dark-3" onClick={onClose} type="button">
            Fechar
          </button>
        </div>

        {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="relative block md:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Categoria *</span>
            <input
              autoComplete="off"
              className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
              onChange={(event) => {
                setCategorySearch(event.target.value);
                setSelectedCategoryId(null);
                setShowCategoryResults(true);
              }}
              onFocus={() => setShowCategoryResults(true)}
              placeholder="Busque pelo nome da categoria"
              required
              value={categorySearch}
            />
            {showCategoryResults && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-md border border-stroke bg-white shadow-2 dark:border-dark-3 dark:bg-gray-dark">
                {filteredCategories.length ? (
                  <ul className="max-h-64 overflow-y-auto py-1">
                    {filteredCategories.map((category) => (
                      <li key={String(category.id_categoria)}>
                        <button
                          className="block w-full px-3 py-2.5 text-left text-sm hover:bg-gray-2 hover:text-primary dark:hover:bg-dark-2"
                          onClick={() => selectCategory(category)}
                          type="button"
                        >
                          <span className="font-semibold">{text(category.categoria)}</span>
                          <span className="ml-2 text-xs text-dark-4">#{category.id_categoria}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-3 py-2.5 text-sm text-dark-4">Nenhuma categoria encontrada.</div>
                )}
              </div>
            )}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Subcategoria *</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.subcategoria || "")} name="subcategoria" placeholder="Nome da subcategoria" required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Status</span>
            <select className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.habilitado || "S")} name="habilitado">
              <option value="S">Ativo</option>
              <option value="N">Inativo</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Icone</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.icon || "")} name="icon" placeholder="Ícone da subcategoria" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Ordem</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.ordem ?? 0)} min={0} name="ordem" placeholder="Ordem de exibição" type="number" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Descricao</span>
            <textarea className="min-h-44 w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.descricao || "")} name="descricao" />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-md border border-stroke px-4 py-2.5 text-sm font-bold dark:border-dark-3" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={saving} type="submit">
            {saving ? "Salvando..." : "Salvar subcategoria"}
          </button>
        </div>
      </form>
    </div>
  );

  return mounted ? createPortal(modal, document.body) : null;
}

export function SubcategoriesPage() {
  const [data, setData] = useState<PaginatedData<Subcategory> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [habilitado, setHabilitado] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalSubcategory, setModalSubcategory] = useState<Subcategory | null | undefined>(undefined);

  const categoryById = useMemo(() => {
    const map = new Map<number, Category>();
    categories.forEach((category) => {
      if (category.id_categoria !== undefined) {
        map.set(Number(category.id_categoria), category);
      }
    });
    return map;
  }, [categories]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listResource<Subcategory>("/api/v1/subcategorias", {
        page,
        limit: 12,
        search,
        habilitado,
      });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar subcategorias");
    } finally {
      setLoading(false);
    }
  }, [habilitado, page, search]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await listResource<Category>("/api/v1/categorias", {
        page: 1,
        limit: 500,
      });
      setCategories(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar categorias");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  async function removeSubcategory(subcategory: Subcategory) {
    const confirmed = window.confirm(`Excluir subcategoria #${String(subcategory.id_subcategoria)}?`);
    if (!confirmed) return;
    await deleteResource("/api/v1/subcategorias", String(subcategory.id_subcategoria));
    await loadData();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Catalogo</p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">Subcategorias</h1>
            <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">Gerencie as subdivisoes das categorias e sua ordenacao.</p>
          </div>
          <button className="rounded-md bg-primary px-4 py-3 text-sm font-bold text-white" onClick={() => setModalSubcategory(null)} type="button">
            Nova subcategoria
          </button>
        </div>
      </section>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <section className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        <div className="grid gap-3 border-b border-stroke p-4 dark:border-dark-3 lg:grid-cols-[1fr_180px]">
          <input
            className="w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar subcategorias"
            value={search}
          />
          <select
            className="rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            onChange={(event) => {
              setHabilitado(event.target.value);
              setPage(1);
            }}
            value={habilitado}
          >
            <option value="">Todos</option>
            <option value="S">Ativas</option>
            <option value="N">Inativas</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3 dark:text-dark-6">
                {["ID", "Categoria", "Subcategoria", "Descricao", "Icone", "Ordem", "Status", "Acoes"].map((header) => (
                  <th className="px-4 py-3 font-semibold" key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={8}>Carregando subcategorias...</td></tr>
              ) : data?.items.length ? (
                data.items.map((subcategory) => {
                  const category = categoryById.get(Number(subcategory.id_categoria));

                  return (
                    <tr className="border-b border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2" key={String(subcategory.id_subcategoria)}>
                      <td className="px-4 py-3 font-bold">#{subcategory.id_subcategoria}</td>
                      <td className="max-w-[260px] px-4 py-3">
                        <span className="block truncate font-semibold">{text(category?.categoria)}</span>
                        <span className="text-xs text-dark-4">#{subcategory.id_categoria}</span>
                      </td>
                      <td className="max-w-[260px] px-4 py-3 font-semibold"><span className="block truncate">{text(subcategory.subcategoria)}</span></td>
                      <td className="max-w-[360px] px-4 py-3"><span className="block truncate">{text(subcategory.descricao)}</span></td>
                      <td className="max-w-[180px] px-4 py-3"><span className="block truncate">{text(subcategory.icon)}</span></td>
                      <td className="px-4 py-3">{text(subcategory.ordem)}</td>
                      <td className="px-4 py-3"><StatusBadge value={subcategory.habilitado} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="rounded-md border border-stroke px-3 py-1.5 text-xs font-bold hover:border-primary hover:text-primary dark:border-dark-3" onClick={() => setModalSubcategory(subcategory)} type="button">Editar</button>
                          <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50" onClick={() => removeSubcategory(subcategory).catch((err) => setError(err instanceof Error ? err.message : "Falha ao excluir"))} type="button">Excluir</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={8}>Nenhuma subcategoria encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-stroke p-4 text-sm dark:border-dark-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-dark-4 dark:text-dark-6">
            {data
              ? `${data.total} subcategorias - pagina ${data.page} de ${data.totalPages || 1}`
              : "Sem dados"}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-stroke px-3 py-2 font-semibold disabled:opacity-40 dark:border-dark-3"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              Anterior
            </button>
            <span className="min-w-16 text-center font-semibold text-dark dark:text-white">
              {page} / {data?.totalPages || 1}
            </span>
            <button
              className="rounded-md border border-stroke px-3 py-2 font-semibold disabled:opacity-40 dark:border-dark-3"
              disabled={!data || page >= data.totalPages || loading}
              onClick={() => setPage((value) => value + 1)}
              type="button"
            >
              Proxima
            </button>
          </div>
        </div>
      </section>

      {modalSubcategory !== undefined && (
        <SubcategoryModal
          categories={categories}
          onClose={() => setModalSubcategory(undefined)}
          onSaved={loadData}
          subcategory={modalSubcategory}
        />
      )}
    </div>
  );
}
