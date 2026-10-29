"use client";

import { FeedbackToast } from "@/components/ui/toast";

import { apiRequest } from "@/lib/api";
import { FormEvent, useEffect, useState } from "react";

type SearchItem = Record<string, unknown>;

type LinkTarget = {
  label: string;
  endpoint: string;
  idField: string;
  nameField: string;
  placeholder: string;
};

const linkTargets: LinkTarget[] = [
  {
    label: "Categoria",
    endpoint: "/api/v1/categorias",
    idField: "id_categoria",
    nameField: "categoria",
    placeholder: "Buscar categoria",
  },
  {
    label: "Subcategoria",
    endpoint: "/api/v1/subcategorias",
    idField: "id_subcategoria",
    nameField: "subcategoria",
    placeholder: "Buscar subcategoria",
  },
  {
    label: "Publico-alvo",
    endpoint: "/api/v1/publicos-alvos",
    idField: "id_publico_alvo",
    nameField: "publico_alvo",
    placeholder: "Buscar publico-alvo",
  },
  {
    label: "Data promocional",
    endpoint: "/api/v1/datas-promocionais",
    idField: "id_data_promocional",
    nameField: "data_promocional",
    placeholder: "Buscar data promocional",
  },
];

const productTarget = {
  label: "Produto",
  endpoint: "/api/v1/produtos",
  idField: "id_produto",
  nameField: "produto",
  placeholder: "Buscar produto por nome ou codigo",
};

function itemId(item: SearchItem, idField: string) {
  const value = item[idField];
  return typeof value === "number" ? value : Number(value);
}

function itemLabel(item: SearchItem, nameField: string, idField: string) {
  const name = item[nameField] ? String(item[nameField]) : `${nameField} #${itemId(item, idField)}`;
  const code = item.codigo ? ` - ${String(item.codigo)}` : "";
  return `${name}${code}`;
}

function SearchSelect({
  label,
  endpoint,
  idField,
  nameField,
  placeholder,
  value,
  onChange,
}: LinkTarget & {
  value: SearchItem | null;
  onChange: (item: SearchItem | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await apiRequest<{ items: SearchItem[] }>(endpoint, {
          query: { search, limit: 8 },
        });
        setItems(response.items);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [endpoint, search]);

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">
          {label}
        </span>
        <input
          className="w-full rounded-md border border-stroke bg-gray-2 px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
          onChange={(event) => {
            setSearch(event.target.value);
            onChange(null);
          }}
          placeholder={placeholder}
          value={value ? itemLabel(value, nameField, idField) : search}
        />
      </label>

      <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-stroke bg-white dark:border-dark-3 dark:bg-dark-2">
        {loading ? (
          <div className="px-3 py-2 text-sm text-dark-4">Buscando...</div>
        ) : items.length ? (
          items.map((item) => (
            <button
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-2 dark:hover:bg-dark-3"
              key={String(item[idField])}
              onClick={() => {
                onChange(item);
                setSearch("");
              }}
              type="button"
            >
              <span className="font-medium text-dark dark:text-white">
                {itemLabel(item, nameField, idField)}
              </span>
              <span className="shrink-0 text-xs text-dark-4">#{String(item[idField])}</span>
            </button>
          ))
        ) : (
          <div className="px-3 py-2 text-sm text-dark-4">Nenhum resultado</div>
        )}
      </div>
    </div>
  );
}

export function ProductLinksPage() {
  const [targetIndex, setTargetIndex] = useState(0);
  const [linkOwner, setLinkOwner] = useState<SearchItem | null>(null);
  const [linkProduct, setLinkProduct] = useState<SearchItem | null>(null);
  const [removeOwner, setRemoveOwner] = useState<SearchItem | null>(null);
  const [removeProduct, setRemoveProduct] = useState<SearchItem | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const target = linkTargets[targetIndex];

  function changeTarget(index: number) {
    setTargetIndex(index);
    setLinkOwner(null);
    setRemoveOwner(null);
    setMessage("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!linkOwner || !linkProduct) return;

    try {
      await apiRequest(`${target.endpoint}/${itemId(linkOwner, target.idField)}/produtos`, {
        method: "POST",
        body: JSON.stringify({ id_produto: itemId(linkProduct, productTarget.idField) }),
      });
      setMessage("Produto vinculado com sucesso.");
      setLinkOwner(null);
      setLinkProduct(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao vincular produto");
    }
  }

  async function handleRemove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!removeOwner || !removeProduct) return;

    try {
      await apiRequest(
        `${target.endpoint}/${itemId(removeOwner, target.idField)}/produtos/${itemId(
          removeProduct,
          productTarget.idField,
        )}`,
        { method: "DELETE" },
      );
      setMessage("Produto desvinculado com sucesso.");
      setRemoveOwner(null);
      setRemoveProduct(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desvincular produto");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Catalogo
        </p>
        <h1 className="mt-2 text-2xl font-bold text-dark dark:text-white">
          Vinculos de produtos
        </h1>
        <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
          Associe produtos a categorias, subcategorias, publicos-alvo e datas promocionais.
        </p>
      </div>

      <FeedbackToast message={error || message} type={error ? "error" : "success"} />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr_1fr]">
        <aside className="rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark">
          <h2 className="text-lg font-bold text-dark dark:text-white">Destino</h2>
          <div className="mt-4 space-y-2">
            {linkTargets.map((item, index) => (
              <button
                className={`w-full rounded-md border px-4 py-3 text-left text-sm font-semibold ${
                  index === targetIndex
                    ? "border-primary text-primary"
                    : "border-stroke text-dark dark:border-dark-3 dark:text-white"
                }`}
                key={item.endpoint}
                onClick={() => changeTarget(index)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <form className="space-y-4 rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark" onSubmit={handleSubmit}>
          <h2 className="text-lg font-bold text-dark dark:text-white">Vincular</h2>
          <SearchSelect {...target} value={linkOwner} onChange={setLinkOwner} />
          <SearchSelect {...productTarget} value={linkProduct} onChange={setLinkProduct} />
          <button
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            disabled={!linkOwner || !linkProduct}
          >
            Vincular produto
          </button>
        </form>

        <form className="space-y-4 rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark" onSubmit={handleRemove}>
          <h2 className="text-lg font-bold text-dark dark:text-white">Desvincular</h2>
          <SearchSelect {...target} value={removeOwner} onChange={setRemoveOwner} />
          <SearchSelect {...productTarget} value={removeProduct} onChange={setRemoveProduct} />
          <button
            className="w-full rounded-md border border-red-200 px-3 py-2 text-sm font-bold text-red-600 disabled:opacity-50"
            disabled={!removeOwner || !removeProduct}
          >
            Remover vinculo
          </button>
        </form>
      </div>
    </div>
  );
}
