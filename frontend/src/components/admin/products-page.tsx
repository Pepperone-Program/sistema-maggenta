"use client";

import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
  type PaginatedData,
} from "@/lib/api";
import { apiRequest } from "@/lib/api";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ProductImagesPanel } from "./product-images-panel";
import { StatusBadge } from "./status-badge";

type Row = Record<string, unknown>;

type ProductLinks = {
  categorias: Row[];
  subcategorias: Row[];
  publicos_alvos: Row[];
  datas_promocionais: Row[];
};

type ProductField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea";
  required?: boolean;
};

const productFields: ProductField[] = [
  { name: "id_tipo_produto", label: "Tipo", type: "number", required: true },
  { name: "produto", label: "Produto", required: true },
  { name: "codigo", label: "Codigo", required: true },
  { name: "cod_forn", label: "Cod. fornecedor" },
  { name: "descricao", label: "Descricao", type: "textarea" },
  { name: "id_tipo_gravacao_padrao", label: "Gravacao padrao", type: "number" },
  { name: "altura", label: "Altura" },
  { name: "largura", label: "Largura" },
  { name: "profundidade", label: "Profundidade" },
  { name: "peso", label: "Peso" },
  { name: "quantidade_minima", label: "Quantidade minima" },
  { name: "caixa1", label: "Caixa 1" },
  { name: "caixa2", label: "Caixa 2" },
  { name: "caixa3", label: "Caixa 3" },
  { name: "caixa4", label: "Caixa 4" },
  { name: "caixa5", label: "Caixa 5" },
  { name: "ncm", label: "NCM" },
  { name: "imagem", label: "Imagem principal" },
  { name: "data_inicial", label: "Data inicial", type: "date" },
  { name: "data_final", label: "Data final", type: "date" },
  { name: "video", label: "Video" },
  { name: "obs", label: "Observacoes", type: "textarea" },
];

const flagFields = [
  ["site", "Site"],
  ["sugerir_sempre", "Sugerir sempre"],
  ["lancamento", "Lancamento"],
  ["promocao", "Promocao"],
  ["premium", "Premium"],
  ["marketplace", "Marketplace"],
  ["habilitado", "Habilitado"],
] as const;

const linkTargets = [
  {
    key: "categorias",
    label: "Categorias",
    endpoint: "/api/v1/categorias",
    idField: "id_categoria",
    nameField: "categoria",
  },
  {
    key: "subcategorias",
    label: "Subcategorias",
    endpoint: "/api/v1/subcategorias",
    idField: "id_subcategoria",
    nameField: "subcategoria",
  },
  {
    key: "publicos_alvos",
    label: "Publicos-alvo",
    endpoint: "/api/v1/publicos-alvos",
    idField: "id_publico_alvo",
    nameField: "publico_alvo",
  },
  {
    key: "datas_promocionais",
    label: "Datas promocionais",
    endpoint: "/api/v1/datas-promocionais",
    idField: "id_data_promocional",
    nameField: "data_promocional",
  },
] as const;

const defaultProduct = {
  id_tipo_produto: 1,
  id_tipo_gravacao_padrao: 0,
  site: "N",
  sugerir_sempre: "N",
  lancamento: "N",
  promocao: "N",
  premium: "N",
  marketplace: "N",
  habilitado: "S",
  data_inicial: new Date().toISOString().slice(0, 10),
  data_final: "2030-12-31",
};

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function normalizeFormValue(type: string | undefined, value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  if (type === "number") return Number(raw);
  return raw;
}

function Field({ field, value }: { field: ProductField; value?: unknown }) {
  const defaultValue =
    value === null || value === undefined
      ? ""
      : field.type === "date"
        ? String(value).slice(0, 10)
        : String(value);
  const inputClass =
    "w-full rounded-md border border-stroke bg-white px-3 py-2.5 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white";

  if (field.type === "textarea") {
    return <textarea className={`${inputClass} min-h-24 resize-y`} defaultValue={defaultValue} name={field.name} />;
  }

  return (
    <input
      className={inputClass}
      defaultValue={defaultValue}
      name={field.name}
      required={field.required}
      type={field.type || "text"}
    />
  );
}

function ProductLinksPanel({ produtoId }: { produtoId: number }) {
  const [links, setLinks] = useState<ProductLinks | null>(null);
  const [options, setOptions] = useState<Record<string, Row[]>>({});
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const loadLinks = useCallback(async () => {
    const response = await apiRequest<ProductLinks>(`/api/v1/produtos/${produtoId}/links`);
    setLinks(response);
  }, [produtoId]);

  useEffect(() => {
    loadLinks().catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar vinculos"));
    linkTargets.forEach((target) => {
      apiRequest<{ items: Row[] }>(target.endpoint, { query: { limit: 100 } })
        .then((response) => setOptions((current) => ({ ...current, [target.key]: response.items })))
        .catch(() => undefined);
    });
  }, [loadLinks]);

  async function addLink(target: (typeof linkTargets)[number]) {
    const id = selected[target.key];
    if (!id) return;
    await apiRequest(`${target.endpoint}/${id}/produtos`, {
      method: "POST",
      body: JSON.stringify({ id_produto: produtoId }),
    });
    setSelected((current) => ({ ...current, [target.key]: "" }));
    await loadLinks();
  }

  async function removeLink(target: (typeof linkTargets)[number], id: unknown) {
    await apiRequest(`${target.endpoint}/${String(id)}/produtos/${produtoId}`, { method: "DELETE" });
    await loadLinks();
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        {linkTargets.map((target) => {
          const linked = (links?.[target.key] || []) as Row[];
          const linkedIds = new Set(linked.map((item) => String(item[target.idField])));
          const available = (options[target.key] || []).filter((item) => !linkedIds.has(String(item[target.idField])));

          return (
            <section className="rounded-md border border-stroke p-4 dark:border-dark-3" key={target.key}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-dark dark:text-white">{target.label}</h3>
                <span className="rounded-md bg-gray-2 px-2 py-1 text-xs font-semibold text-dark-4 dark:bg-dark-2">
                  {linked.length}
                </span>
              </div>

              <div className="mb-3 flex gap-2">
                <select
                  className="min-w-0 flex-1 rounded-md border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                  onChange={(event) => setSelected((current) => ({ ...current, [target.key]: event.target.value }))}
                  value={selected[target.key] || ""}
                >
                  <option value="">Adicionar...</option>
                  {available.map((item) => (
                    <option key={String(item[target.idField])} value={String(item[target.idField])}>
                      {text(item[target.nameField])}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  disabled={!selected[target.key]}
                  onClick={() => addLink(target).catch((err) => setError(err instanceof Error ? err.message : "Falha ao vincular"))}
                  type="button"
                >
                  Vincular
                </button>
              </div>

              <div className="space-y-2">
                {linked.length ? (
                  linked.map((item) => (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-gray-2 px-3 py-2 dark:bg-dark-2" key={String(item[target.idField])}>
                      <span className="truncate text-sm font-medium text-dark dark:text-white">{text(item[target.nameField])}</span>
                      <button
                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600"
                        onClick={() => removeLink(target, item[target.idField]).catch((err) => setError(err instanceof Error ? err.message : "Falha ao remover"))}
                        type="button"
                      >
                        Remover
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md bg-gray-2 px-3 py-4 text-center text-sm text-dark-4 dark:bg-dark-2">Sem vinculos.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: Row | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"dados" | "vinculos" | "imagens">("dados");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const values = useMemo<Row>(() => ({ ...defaultProduct, ...(product || {}) }), [product]);
  const productId = product?.id_produto ? Number(product.id_produto) : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {};

    productFields.forEach((field) => {
      const value = normalizeFormValue(field.type, formData.get(field.name));
      if (value !== undefined) payload[field.name] = value;
    });
    flagFields.forEach(([name]) => {
      payload[name] = String(formData.get(name) || "N");
    });

    try {
      if (productId) {
        await updateResource("/api/v1/produtos", productId, payload);
      } else {
        await createResource("/api/v1/produtos", payload);
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar produto");
    } finally {
      setSaving(false);
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        className="flex h-[86vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-lg bg-white shadow-2 dark:bg-gray-dark"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="border-b border-stroke px-6 py-5 dark:border-dark-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{productId ? `Produto #${productId}` : "Novo produto"}</p>
              <h2 className="mt-1 text-2xl font-bold text-dark dark:text-white">{text(values.produto) === "-" ? "Cadastro de produto" : text(values.produto)}</h2>
              <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">{text(values.codigo)} · {text(values.altura)} x {text(values.largura)} x {text(values.profundidade)}</p>
            </div>
            <button className="rounded-md border border-stroke px-3 py-2 text-sm font-semibold dark:border-dark-3" onClick={onClose} type="button">
              Fechar
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(["dados", "vinculos", "imagens"] as const).map((item) => (
              <button
                className={`rounded-md px-4 py-2 text-sm font-bold ${tab === item ? "bg-primary text-white" : "bg-gray-2 text-dark dark:bg-dark-2 dark:text-white"}`}
                disabled={item !== "dados" && !productId}
                key={item}
                onClick={() => setTab(item)}
                type="button"
              >
                {item === "dados" ? "Informacoes" : item === "vinculos" ? "Vinculos" : "Imagens"}
              </button>
            ))}
          </div>
        </header>

        <main className="overflow-y-auto p-6">
          {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}

          {tab === "dados" && (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {productFields.map((field) => (
                  <label className={field.type === "textarea" ? "block md:col-span-2" : "block"} key={field.name}>
                    <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">
                      {field.label}
                      {field.required && <span className="text-red-500"> *</span>}
                    </span>
                    <Field field={field} value={values[field.name]} />
                  </label>
                ))}
              </div>

              <div className="grid gap-3 rounded-md border border-stroke p-4 dark:border-dark-3 sm:grid-cols-2 lg:grid-cols-4">
                {flagFields.map(([name, label]) => (
                  <label className="flex items-center justify-between rounded-md bg-gray-2 px-3 py-2 dark:bg-dark-2" key={name}>
                    <span className="text-sm font-semibold text-dark dark:text-white">{label}</span>
                    <select className="rounded-md border border-stroke bg-white px-2 py-1 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white" defaultValue={String(values[name] || "N")} name={name}>
                      <option value="S">S</option>
                      <option value="N">N</option>
                    </select>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button className="rounded-md border border-stroke px-4 py-2.5 text-sm font-bold dark:border-dark-3" onClick={onClose} type="button">
                  Cancelar
                </button>
                <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={saving} type="submit">
                  {saving ? "Salvando..." : "Salvar produto"}
                </button>
              </div>
            </form>
          )}

          {tab === "vinculos" && productId && <ProductLinksPanel produtoId={productId} />}

          {tab === "imagens" && productId && (
            <ProductImagesPanel endpoint="/api/v1/produtos" onChanged={onSaved} produtoId={productId} produtoNome={values.produto} />
          )}
        </main>
      </div>
    </div>
  );

  return mounted ? createPortal(modal, document.body) : null;
}

export function ProductsPage() {
  const [data, setData] = useState<PaginatedData<Row> | null>(null);
  const [search, setSearch] = useState("");
  const [site, setSite] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalProduct, setModalProduct] = useState<Row | null | undefined>(undefined);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await listResource<Row>("/api/v1/produtos", { page, limit: 12, search, site });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }, [page, search, site]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDelete(row: Row) {
    const confirmed = window.confirm(`Excluir produto #${String(row.id_produto)}?`);
    if (!confirmed) return;
    await deleteResource("/api/v1/produtos", String(row.id_produto));
    await loadData();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Catalogo Pepperone</p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">Produtos</h1>
            <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
              Edite dados, imagens e vinculos comerciais em um unico modal.
            </p>
          </div>
          <button className="rounded-md bg-primary px-4 py-3 text-sm font-bold text-white" onClick={() => setModalProduct(null)} type="button">
            Novo produto
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
            placeholder="Buscar por ID, codigo ou produto"
            value={search}
          />
          <select
            className="rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            onChange={(event) => {
              setSite(event.target.value);
              setPage(1);
            }}
            value={site}
          >
            <option value="">Site: todos</option>
            <option value="S">Site: S</option>
            <option value="N">Site: N</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead>
              <tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3 dark:text-dark-6">
                {["ID", "Codigo", "Produto", "Largura", "Altura", "Profundidade", "Qtd. min.", "Site", "Status", "Promocao", "Acoes"].map((header) => (
                  <th className="px-4 py-3 font-semibold" key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={11}>Carregando produtos...</td></tr>
              ) : data?.items.length ? (
                data.items.map((row) => (
                  <tr className="border-b border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2" key={String(row.id_produto)}>
                    <td className="px-4 py-3 font-bold">#{text(row.id_produto)}</td>
                    <td className="px-4 py-3">{text(row.codigo)}</td>
                    <td className="max-w-[360px] px-4 py-3">
                      <p className="truncate font-semibold">{text(row.produto)}</p>
                      <p className="truncate text-xs text-dark-4">{text(row.descricao)}</p>
                    </td>
                    <td className="px-4 py-3">{text(row.largura)}</td>
                    <td className="px-4 py-3">{text(row.altura)}</td>
                    <td className="px-4 py-3">{text(row.profundidade)}</td>
                    <td className="px-4 py-3">{text(row.quantidade_minima)}</td>
                    <td className="px-4 py-3"><StatusBadge value={row.site} /></td>
                    <td className="px-4 py-3"><StatusBadge value={row.habilitado} /></td>
                    <td className="px-4 py-3"><StatusBadge value={row.promocao} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="rounded-md border border-stroke px-3 py-1.5 text-xs font-bold hover:border-primary hover:text-primary dark:border-dark-3" onClick={() => setModalProduct(row)} type="button">
                          Editar
                        </button>
                        <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50" onClick={() => handleDelete(row).catch((err) => setError(err instanceof Error ? err.message : "Falha ao excluir"))} type="button">
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={11}>Nenhum produto encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-stroke p-4 text-sm dark:border-dark-3">
          <span className="text-dark-4 dark:text-dark-6">{data ? `${data.total} produtos` : "Sem dados"}</span>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-stroke px-3 py-2 disabled:opacity-40 dark:border-dark-3" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
              Anterior
            </button>
            <span className="text-dark dark:text-white">{page} / {data?.totalPages || 1}</span>
            <button className="rounded-md border border-stroke px-3 py-2 disabled:opacity-40 dark:border-dark-3" disabled={!data || page >= data.totalPages} onClick={() => setPage((value) => value + 1)} type="button">
              Proxima
            </button>
          </div>
        </div>
      </section>

      {modalProduct !== undefined && (
        <ProductModal product={modalProduct} onClose={() => setModalProduct(undefined)} onSaved={loadData} />
      )}
    </div>
  );
}
