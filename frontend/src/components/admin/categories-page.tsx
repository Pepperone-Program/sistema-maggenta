"use client";

import {
  apiFormRequest,
  createResource,
  deleteResource,
  listResource,
  updateResource,
  type PaginatedData,
} from "@/lib/api";
import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "./status-badge";

type Category = Record<string, unknown> & {
  id_categoria?: number;
  categoria?: string;
  descricao?: string | null;
  icon?: string | null;
  habilitado?: string | null;
  url_capa?: string | null;
};

const defaultCategory: Category = {
  habilitado: "S",
};

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function CategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(String(category?.url_capa || ""));
  const [selectedCover, setSelectedCover] = useState<File | null>(null);
  const values = useMemo(() => ({ ...defaultCategory, ...(category || {}) }), [category]);
  const categoryId = category?.id_categoria ? Number(category.id_categoria) : null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!selectedCover) return;

    const objectUrl = URL.createObjectURL(selectedCover);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedCover]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      categoria: String(form.get("categoria") || "").trim(),
      descricao: String(form.get("descricao") || ""),
      icon: String(form.get("icon") || ""),
      habilitado: String(form.get("habilitado") || "N"),
      url_capa: String(form.get("url_capa") || ""),
    };

    try {
      let savedCategory: Category;

      if (categoryId) {
        savedCategory = await updateResource<Category>("/api/v1/categorias", categoryId, payload);
      } else {
        savedCategory = await createResource<Category>("/api/v1/categorias", payload);
      }

      const savedCategoryId = categoryId || Number(savedCategory.id_categoria);

      if (selectedCover && savedCategoryId) {
        await uploadCover(selectedCover, savedCategoryId, false, true);
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar categoria");
    } finally {
      setSaving(false);
    }
  }

  async function uploadCover(
    file: File,
    targetCategoryId = categoryId,
    refreshAfterUpload = true,
    rethrowError = false,
  ) {
    if (!targetCategoryId) {
      setSelectedCover(file);
      setError("");
      return;
    }

    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await apiFormRequest<Category>(`/api/v1/categorias/${targetCategoryId}/capa`, formData);
      setPreviewUrl(String(response.url_capa || ""));
      setSelectedCover(null);
      if (refreshAfterUpload) {
        await onSaved();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar capa");
      if (rethrowError) {
        throw err;
      }
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = Array.from(event.dataTransfer.files || []).find((item) => item.type.startsWith("image/"));
    if (file) uploadCover(file);
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        className="grid max-h-[90vh] w-full max-w-[1400px] overflow-hidden rounded-lg bg-white shadow-2 dark:bg-gray-dark lg:grid-cols-[420px_1fr]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="overflow-y-auto border-r border-stroke bg-gray-2 p-5 dark:border-dark-3 dark:bg-dark-2">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            {categoryId ? `Categoria #${categoryId}` : "Nova categoria"}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-dark dark:text-white">{text(values.categoria)}</h2>

          <div
            className={`mt-5 rounded-md border border-dashed p-3 transition ${
              dragActive ? "border-primary bg-primary/5" : "border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark"
            }`}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDrop={handleDrop}
          >
            <div className="overflow-hidden rounded-md border border-stroke bg-gray-2 dark:border-dark-3 dark:bg-dark-2">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Capa da categoria" className="h-auto w-full object-contain" src={previewUrl} />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-dark-4">
                  Sem capa
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-dark-4 dark:text-dark-6">
              Arraste uma imagem aqui para atualizar a capa.
              {!categoryId && selectedCover ? " Ela sera enviada ao salvar." : ""}
            </p>
            <label className="mt-3 inline-flex cursor-pointer rounded-md bg-primary px-3 py-2 text-xs font-bold text-white">
              {uploading ? "Enviando..." : selectedCover ? "Imagem selecionada" : "Selecionar imagem"}
              <input
                accept="image/*"
                className="hidden"
                disabled={uploading || saving}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadCover(file);
                }}
                type="file"
              />
            </label>
          </div>
        </aside>

        <form className="overflow-y-auto p-6" onSubmit={handleSubmit}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">Informacoes</h3>
              <p className="text-sm text-dark-4 dark:text-dark-6">Edite textos, icone, capa e status.</p>
            </div>
            <button className="rounded-md border border-stroke px-3 py-2 text-sm font-semibold dark:border-dark-3" onClick={onClose} type="button">
              Fechar
            </button>
          </div>

          {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Categoria *</span>
              <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.categoria || "")} name="categoria" placeholder="Nome da categoria" required />
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
              <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.icon || "")} name="icon" placeholder="Ícone da categoria" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">URL da capa</span>
              <input
                className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                defaultValue={String(values.url_capa || "")}
                name="url_capa"
                onChange={(event) => setPreviewUrl(event.target.value)}
                placeholder="URL da capa"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Descricao</span>
              <textarea className="min-h-72 w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.descricao || "")} name="descricao" />
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button className="rounded-md border border-stroke px-4 py-2.5 text-sm font-bold dark:border-dark-3" onClick={onClose} type="button">
              Cancelar
            </button>
            <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={saving} type="submit">
              {saving ? "Salvando..." : selectedCover ? "Salvar e enviar capa" : "Salvar categoria"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return mounted ? createPortal(modal, document.body) : null;
}

export function CategoriesPage() {
  const [data, setData] = useState<PaginatedData<Category> | null>(null);
  const [search, setSearch] = useState("");
  const [habilitado, setHabilitado] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalCategory, setModalCategory] = useState<Category | null | undefined>(undefined);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listResource<Category>("/api/v1/categorias", { page, limit: 12, search, habilitado });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar categorias");
    } finally {
      setLoading(false);
    }
  }, [habilitado, page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function removeCategory(category: Category) {
    const confirmed = window.confirm(`Excluir categoria #${String(category.id_categoria)}?`);
    if (!confirmed) return;
    await deleteResource("/api/v1/categorias", String(category.id_categoria));
    await loadData();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Catalogo</p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">Categorias</h1>
            <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">Gerencie textos, icones e capas das categorias.</p>
          </div>
          <button className="rounded-md bg-primary px-4 py-3 text-sm font-bold text-white" onClick={() => setModalCategory(null)} type="button">
            Nova categoria
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
            placeholder="Buscar categorias"
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
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead>
              <tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3 dark:text-dark-6">
                {["Capa", "ID", "Categoria", "Descricao", "Icone", "Status", "Acoes"].map((header) => (
                  <th className="px-4 py-3 font-semibold" key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={7}>Carregando categorias...</td></tr>
              ) : data?.items.length ? (
                data.items.map((category) => (
                  <tr className="border-b border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2" key={String(category.id_categoria)}>
                    <td className="px-4 py-3">
                      <div className="h-20 w-32 overflow-hidden rounded-md border border-stroke bg-gray-2 dark:border-dark-3">
                        {category.url_capa ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt={text(category.categoria)} className="h-full w-full object-contain" src={category.url_capa} />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold">#{category.id_categoria}</td>
                    <td className="max-w-[260px] px-4 py-3 font-semibold"><span className="block truncate">{text(category.categoria)}</span></td>
                    <td className="max-w-[420px] px-4 py-3"><span className="block truncate">{text(category.descricao)}</span></td>
                    <td className="max-w-[180px] px-4 py-3"><span className="block truncate">{text(category.icon)}</span></td>
                    <td className="px-4 py-3"><StatusBadge value={category.habilitado} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="rounded-md border border-stroke px-3 py-1.5 text-xs font-bold hover:border-primary hover:text-primary dark:border-dark-3" onClick={() => setModalCategory(category)} type="button">Editar</button>
                        <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50" onClick={() => removeCategory(category).catch((err) => setError(err instanceof Error ? err.message : "Falha ao excluir"))} type="button">Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={7}>Nenhuma categoria encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-stroke p-4 text-sm dark:border-dark-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-dark-4 dark:text-dark-6">
            {data
              ? `${data.total} categorias - pagina ${data.page} de ${data.totalPages || 1}`
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

      {modalCategory !== undefined && <CategoryModal category={modalCategory} onClose={() => setModalCategory(undefined)} onSaved={loadData} />}
    </div>
  );
}
