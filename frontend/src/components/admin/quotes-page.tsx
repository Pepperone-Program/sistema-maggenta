"use client";

import {
  apiRequest,
  deleteResource,
  listResource,
  updateResource,
  type PaginatedData,
} from "@/lib/api";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Quote = Record<string, unknown> & {
  id_orcamento?: number;
  data_orcamento?: string | null;
  fantasia?: string | null;
  endereco?: string | null;
  endereco_n?: string | null;
  endereco_compl?: string | null;
  bairro?: string | null;
  cep?: string | null;
  cidade?: string | null;
  uf?: string | null;
  pais?: string | null;
  tel?: string | null;
  tel2?: string | null;
  site?: string | null;
  email?: string | null;
  obs?: string | null;
  contato?: string | null;
  frete?: string | null;
  frete_valor?: string | null;
  diluir_frete?: string | null;
  nivel?: string | null;
  entrega?: string | null;
  itens?: QuoteItem[];
};

type QuoteItem = Record<string, unknown> & {
  id_item?: number;
  id_produto?: number;
  codigo?: string | null;
  produto?: string | null;
  produto_cor?: string | null;
  gravacao_cores?: string | null;
  quantidade?: number | string | null;
  preco_unitario?: string | null;
  preco_unitario_final?: string | null;
};

type ProductImage = {
  url_imagem?: string | null;
};

type ProductPreview = {
  imagem?: string | null;
  images?: ProductImage[];
};

const defaultQuote: Quote = {
  data_orcamento: new Date().toISOString().slice(0, 10),
  pais: "BRASIL",
  frete: "E",
  diluir_frete: "N",
};

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function dateInputValue(value: unknown) {
  return value ? String(value).slice(0, 10) : "";
}

function normalizeFormValue(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw === "" ? undefined : raw;
}

function imageUrlForProduct(product?: ProductPreview) {
  return product?.images?.[0]?.url_imagem || product?.imagem || "";
}

function QuoteEditModal({
  onClose,
  onSaved,
  quote,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
  quote: Quote;
}) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const values = useMemo(() => ({ ...defaultQuote, ...quote }), [quote]);

  useEffect(() => setMounted(true), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote.id_orcamento) return;

    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = [
      "data_orcamento",
      "fantasia",
      "contato",
      "email",
      "tel",
      "tel2",
      "site",
      "endereco",
      "endereco_n",
      "endereco_compl",
      "bairro",
      "cep",
      "cidade",
      "uf",
      "pais",
      "frete",
      "frete_valor",
      "diluir_frete",
      "nivel",
      "entrega",
      "obs",
    ].reduce<Record<string, unknown>>((acc, field) => {
      const value = normalizeFormValue(form.get(field));
      if (value !== undefined) acc[field] = value;
      return acc;
    }, {});

    try {
      await updateResource("/api/v1/orcamentos", quote.id_orcamento, payload);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar orçamento");
    } finally {
      setSaving(false);
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <form
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white p-6 shadow-2 dark:bg-gray-dark"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Orçamento #{quote.id_orcamento}</p>
            <h2 className="mt-1 text-xl font-bold text-dark dark:text-white">Editar orçamento</h2>
          </div>
          <button className="rounded-md border border-stroke px-3 py-2 text-sm font-semibold dark:border-dark-3" onClick={onClose} type="button">
            Fechar
          </button>
        </div>

        {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Data</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={dateInputValue(values.data_orcamento)} name="data_orcamento" placeholder="Data do orçamento" type="date" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Cliente</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.fantasia || "")} name="fantasia" placeholder="Nome fantasia do cliente" required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Contato</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.contato || "")} name="contato" placeholder="Nome do contato" required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Email</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.email || "")} name="email" placeholder="email@cliente.com" required type="email" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Telefone</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.tel || "")} name="tel" placeholder="Telefone principal" required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Telefone 2</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.tel2 || "")} name="tel2" placeholder="Telefone alternativo" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Endereço</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.endereco || "")} name="endereco" placeholder="Endereço completo" required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Número</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.endereco_n || "")} name="endereco_n" placeholder="Número" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Complemento</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.endereco_compl || "")} name="endereco_compl" placeholder="Complemento" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Bairro</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.bairro || "")} name="bairro" placeholder="Bairro" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">CEP</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.cep || "")} name="cep" placeholder="CEP" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Cidade</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.cidade || "")} name="cidade" placeholder="Cidade" required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">UF</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm uppercase dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.uf || "")} maxLength={2} name="uf" placeholder="UF" required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Site</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.site || "")} name="site" placeholder="Site do cliente" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Entrega</span>
            <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.entrega || "")} name="entrega" placeholder="Condição de entrega" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Observações</span>
            <textarea className="min-h-36 w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.obs || "")} name="obs" placeholder="Observações do orçamento" />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-md border border-stroke px-4 py-2.5 text-sm font-bold dark:border-dark-3" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={saving} type="submit">
            {saving ? "Salvando..." : "Salvar orçamento"}
          </button>
        </div>
      </form>
    </div>
  );

  return mounted ? createPortal(modal, document.body) : null;
}

function QuoteViewModal({
  onClose,
  quoteId,
}: {
  onClose: () => void;
  quoteId: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [products, setProducts] = useState<Record<number, ProductPreview>>({});
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    async function loadQuote() {
      setLoading(true);
      setError("");
      try {
        const response = await apiRequest<Quote>(`/api/v1/orcamentos/${quoteId}`, {
          query: { includeItems: "true" },
        });
        setQuote(response);

        const productIds = Array.from(
          new Set((response.itens || []).map((item) => Number(item.id_produto)).filter(Boolean)),
        );
        const pairs = await Promise.all(
          productIds.map(async (productId) => {
            try {
              const images = await apiRequest<ProductImage[]>(`/api/v1/produtos/${productId}/images`);
              return [productId, { images }] as const;
            } catch {
              return [productId, { images: [] }] as const;
            }
          }),
        );
        setProducts(Object.fromEntries(pairs));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar orçamento");
      } finally {
        setLoading(false);
      }
    }

    loadQuote();
  }, [quoteId]);

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white p-6 shadow-2 dark:bg-gray-dark"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Orçamento #{quoteId}</p>
            <h2 className="mt-1 text-2xl font-bold text-dark dark:text-white">{text(quote?.fantasia)}</h2>
            <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">{formatDate(quote?.data_orcamento)}</p>
          </div>
          <button className="rounded-md border border-stroke px-3 py-2 text-sm font-semibold dark:border-dark-3" onClick={onClose} type="button">
            Fechar
          </button>
        </div>

        {loading ? (
          <div className="rounded-md bg-gray-2 px-4 py-8 text-center text-sm text-dark-4 dark:bg-dark-2">Carregando orçamento...</div>
        ) : error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>
        ) : quote ? (
          <div className="space-y-6">
            <section className="grid gap-3 rounded-md bg-gray-2 p-4 text-sm dark:bg-dark-2 md:grid-cols-3">
              <div><span className="block text-xs text-dark-4">Contato</span><strong>{text(quote.contato)}</strong></div>
              <div><span className="block text-xs text-dark-4">Email</span><strong>{text(quote.email)}</strong></div>
              <div><span className="block text-xs text-dark-4">Telefone</span><strong>{text(quote.tel)}</strong></div>
              <div><span className="block text-xs text-dark-4">Cidade</span><strong>{text(quote.cidade)} / {text(quote.uf)}</strong></div>
              <div><span className="block text-xs text-dark-4">Entrega</span><strong>{text(quote.entrega)}</strong></div>
              <div><span className="block text-xs text-dark-4">Frete</span><strong>{text(quote.frete)}</strong></div>
            </section>

            <section>
              <h3 className="mb-3 text-lg font-bold text-dark dark:text-white">Produtos do orçamento</h3>
              <div className="space-y-3">
                {quote.itens?.length ? (
                  quote.itens.map((item) => {
                    const imageUrl = imageUrlForProduct(products[Number(item.id_produto)]);

                    return (
                      <article className="grid gap-4 rounded-md border border-stroke p-3 dark:border-dark-3 md:grid-cols-[120px_1fr_auto]" key={String(item.id_item)}>
                        <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-md bg-gray-2 dark:bg-dark-2">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt={text(item.produto)} className="h-full w-full object-contain" src={imageUrl} />
                          ) : (
                            <span className="text-xs text-dark-4">Sem imagem</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase text-primary">#{item.id_produto} - {text(item.codigo)}</p>
                          <h4 className="mt-1 font-bold text-dark dark:text-white">{text(item.produto)}</h4>
                          <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">Cor: {text(item.produto_cor)}</p>
                          <p className="text-sm text-dark-4 dark:text-dark-6">Gravação: {text(item.gravacao_cores)}</p>
                        </div>
                        <div className="text-left md:text-right">
                          <span className="block text-xs text-dark-4">Quantidade</span>
                          <strong className="text-lg text-dark dark:text-white">{text(item.quantidade)}</strong>
                          <span className="mt-2 block text-xs text-dark-4">Valor final</span>
                          <strong>{text(item.preco_unitario_final || item.preco_unitario)}</strong>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-md bg-gray-2 px-4 py-8 text-center text-sm text-dark-4 dark:bg-dark-2">Nenhum produto no orçamento.</div>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );

  return mounted ? createPortal(modal, document.body) : null;
}

export function QuotesPage() {
  const [data, setData] = useState<PaginatedData<Quote> | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [viewQuoteId, setViewQuoteId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await listResource<Quote>("/api/v1/orcamentos", {
        page,
        limit: 12,
        search,
      });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar orçamentos");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function removeQuote(quote: Quote) {
    const confirmed = window.confirm(`Excluir orçamento #${String(quote.id_orcamento)}?`);
    if (!confirmed) return;
    await deleteResource("/api/v1/orcamentos", String(quote.id_orcamento));
    await loadData();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Comercial</p>
          <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">Orçamentos</h1>
          <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">Acompanhe propostas, contatos e produtos solicitados.</p>
        </div>
      </section>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <section className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        <div className="border-b border-stroke p-4 dark:border-dark-3">
          <input
            className="w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white lg:max-w-xl"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar orçamentos por cliente, email ou contato"
            value={search}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead>
              <tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3 dark:text-dark-6">
                {["ID", "Data", "Cliente", "Contato", "Email", "Telefone", "Cidade", "Entrega", "Ações"].map((header) => (
                  <th className="px-4 py-3 font-semibold" key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={9}>Carregando orçamentos...</td></tr>
              ) : data?.items.length ? (
                data.items.map((quote) => (
                  <tr className="border-b border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2" key={String(quote.id_orcamento)}>
                    <td className="px-4 py-3 font-bold">#{quote.id_orcamento}</td>
                    <td className="px-4 py-3">{formatDate(quote.data_orcamento)}</td>
                    <td className="max-w-[260px] px-4 py-3 font-semibold"><span className="block truncate">{text(quote.fantasia)}</span></td>
                    <td className="max-w-[220px] px-4 py-3"><span className="block truncate">{text(quote.contato)}</span></td>
                    <td className="max-w-[260px] px-4 py-3"><span className="block truncate">{text(quote.email)}</span></td>
                    <td className="px-4 py-3">{text(quote.tel)}</td>
                    <td className="px-4 py-3">{text(quote.cidade)} / {text(quote.uf)}</td>
                    <td className="max-w-[180px] px-4 py-3"><span className="block truncate">{text(quote.entrega)}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="rounded-md border border-stroke px-3 py-1.5 text-xs font-bold hover:border-primary hover:text-primary dark:border-dark-3" onClick={() => setViewQuoteId(Number(quote.id_orcamento))} type="button">Ver</button>
                        <button className="rounded-md border border-stroke px-3 py-1.5 text-xs font-bold hover:border-primary hover:text-primary dark:border-dark-3" onClick={() => setEditingQuote(quote)} type="button">Editar</button>
                        <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50" onClick={() => removeQuote(quote).catch((err) => setError(err instanceof Error ? err.message : "Falha ao excluir"))} type="button">Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={9}>Nenhum orçamento encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-stroke p-4 text-sm dark:border-dark-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-dark-4 dark:text-dark-6">
            {data ? `${data.total} orçamentos - página ${data.page} de ${data.totalPages || 1}` : "Sem dados"}
          </span>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-stroke px-3 py-2 font-semibold disabled:opacity-40 dark:border-dark-3" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">
              Anterior
            </button>
            <span className="min-w-16 text-center font-semibold text-dark dark:text-white">{page} / {data?.totalPages || 1}</span>
            <button className="rounded-md border border-stroke px-3 py-2 font-semibold disabled:opacity-40 dark:border-dark-3" disabled={!data || page >= data.totalPages || loading} onClick={() => setPage((value) => value + 1)} type="button">
              Próxima
            </button>
          </div>
        </div>
      </section>

      {editingQuote && <QuoteEditModal onClose={() => setEditingQuote(null)} onSaved={loadData} quote={editingQuote} />}
      {viewQuoteId !== null && <QuoteViewModal onClose={() => setViewQuoteId(null)} quoteId={viewQuoteId} />}
    </div>
  );
}
