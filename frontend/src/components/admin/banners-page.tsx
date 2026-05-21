"use client";

import { apiFormRequest, apiRequest, createResource, deleteResource, updateResource, type PaginatedData } from "@/lib/api";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "./status-badge";

type Banner = {
  id_empresa?: number;
  id_banner?: number;
  tipo: string;
  titulo?: string | null;
  url?: string | null;
  id_tipo_produto?: number | null;
  data_inicial?: string | null;
  data_final?: string | null;
  ordem?: number | null;
  habilitado?: string | null;
  cliques?: number | null;
  url_banner?: string | null;
  tamanho_tela?: string | null;
};

const bannerTipos = [
  { label: "Home mega", value: "home_mega" },
  { label: "Home grande", value: "home_grande" },
  { label: "Banner medio", value: "banner_medio" },
  { label: "Mega banner", value: "mega_banner" },
];

const defaultBanner: Banner = {
  tipo: "home_mega",
  titulo: "",
  url: "",
  id_tipo_produto: 0,
  data_inicial: new Date().toISOString().slice(0, 10),
  data_final: "2030-12-31",
  ordem: 0,
  habilitado: "S",
  cliques: null,
  url_banner: "",
  tamanho_tela: "",
};

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function dateValue(value: unknown) {
  return value ? String(value).slice(0, 10) : "";
}

function DropZone({
  label,
  file,
  onFile,
}: {
  label: string;
  file: File | null;
  onFile: (file: File | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function acceptFiles(files: FileList | null) {
    const nextFile = Array.from(files || []).find((item) => item.type.startsWith("image/"));
    if (nextFile) onFile(nextFile);
  }

  return (
    <label
      className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-4 text-center transition ${
        dragging ? "border-primary bg-primary/5" : "border-stroke bg-gray-2 dark:border-dark-3 dark:bg-dark-2"
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        acceptFiles(event.dataTransfer.files);
      }}
    >
      <input className="hidden" onChange={(event) => acceptFiles(event.target.files)} type="file" accept="image/*" />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={label} className="max-h-32 w-full rounded-md object-contain" src={preview} />
      ) : (
        <span className="text-sm font-semibold text-dark dark:text-white">{label}</span>
      )}
      <span className="mt-2 text-xs text-dark-4 dark:text-dark-6">{file ? file.name : "Arraste ou selecione uma imagem"}</span>
    </label>
  );
}

function BannerModal({
  banner,
  onClose,
  onSaved,
}: {
  banner: Banner | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(String(banner?.url_banner || ""));
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const values = useMemo(() => ({ ...defaultBanner, ...(banner || {}) }), [banner]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      tipo: String(form.get("tipo") || "home_mega"),
      titulo: String(form.get("titulo") || ""),
      url: String(form.get("url") || ""),
      id_tipo_produto: Number(form.get("id_tipo_produto") || 0),
      data_inicial: String(form.get("data_inicial") || ""),
      data_final: String(form.get("data_final") || ""),
      ordem: Number(form.get("ordem") || 0),
      habilitado: String(form.get("habilitado") || "N"),
      cliques: form.get("cliques") ? Number(form.get("cliques")) : null,
      url_banner: String(form.get("url_banner") || ""),
      tamanho_tela: String(form.get("tamanho_tela") || ""),
    };

    try {
      if (banner?.id_banner) {
        await updateResource("/api/v1/banners", banner.id_banner, payload);
      } else if (desktopFile || mobileFile) {
        if (!desktopFile || !mobileFile) {
          throw new Error("Envie as imagens desktop e mobile");
        }
        const uploadData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== null && value !== undefined) uploadData.set(key, String(value));
        });
        uploadData.append("desktop", desktopFile);
        uploadData.append("mobile", mobileFile);
        await apiFormRequest<Banner[]>("/api/v1/banners/responsive", uploadData);
      } else {
        await createResource("/api/v1/banners", payload);
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar banner");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        className="grid max-h-[90vh] w-full max-w-[1500px] overflow-hidden rounded-lg bg-white shadow-2 dark:bg-gray-dark lg:grid-cols-[minmax(0,1fr)_460px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <section className="overflow-y-auto bg-gray-2 p-5 dark:bg-dark-2">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              {banner?.id_banner ? `Banner #${banner.id_banner}` : "Novo banner"}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-dark dark:text-white">
              {text(values.titulo) === "-" ? "Banner" : text(values.titulo)}
            </h2>
          </div>

          <div className="overflow-hidden rounded-md border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Preview do banner" className="h-auto w-full object-contain" src={previewUrl} />
            ) : (
              <div className="flex aspect-[21/8] items-center justify-center text-sm text-dark-4">
                Preview indisponivel
              </div>
            )}
          </div>

          {!banner?.id_banner && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <DropZone file={desktopFile} label="Banner desktop" onFile={setDesktopFile} />
              <DropZone file={mobileFile} label="Banner mobile" onFile={setMobileFile} />
            </div>
          )}
        </section>

        <form className="overflow-y-auto p-5" onSubmit={handleSubmit}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-dark dark:text-white">Informacoes</h3>
              <p className="text-sm text-dark-4 dark:text-dark-6">Edite exibicao, periodo, destino e imagem.</p>
            </div>
            <button className="rounded-md border border-stroke px-3 py-2 text-sm font-semibold dark:border-dark-3" onClick={onClose} type="button">
              Fechar
            </button>
          </div>

          {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Tipo</span>
              <select className="w-full rounded-md border border-stroke bg-white px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={values.tipo} name="tipo">
                {bannerTipos.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Titulo</span>
              <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.titulo || "")} name="titulo" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">URL destino</span>
              <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.url || "")} name="url" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">URL da imagem</span>
              <input
                className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                defaultValue={String(values.url_banner || "")}
                name="url_banner"
                onChange={(event) => setPreviewUrl(event.target.value)}
              />
            </label>

            {banner?.id_banner && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Versao</span>
                <select className="w-full rounded-md border border-stroke bg-white px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.tamanho_tela || "")} name="tamanho_tela">
                  <option value="">Nao definida</option>
                  <option value="desktop">Desktop</option>
                  <option value="mobile">Mobile</option>
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Inicio</span>
                <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={dateValue(values.data_inicial)} name="data_inicial" type="date" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Fim</span>
                <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={dateValue(values.data_final)} name="data_final" type="date" />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Produto</span>
                <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.id_tipo_produto ?? 0)} name="id_tipo_produto" type="number" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Ordem</span>
                <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={String(values.ordem ?? 0)} name="ordem" type="number" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">Cliques</span>
                <input className="w-full rounded-md border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" defaultValue={values.cliques === null || values.cliques === undefined ? "" : String(values.cliques)} name="cliques" type="number" />
              </label>
            </div>

            <label className="flex items-center justify-between rounded-md bg-gray-2 px-3 py-2 dark:bg-dark-2">
              <span className="text-sm font-semibold text-dark dark:text-white">Habilitado</span>
              <select className="rounded-md border border-stroke bg-white px-3 py-1.5 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white" defaultValue={String(values.habilitado || "S")} name="habilitado">
                <option value="S">S</option>
                <option value="N">N</option>
              </select>
            </label>
          </div>

          <button className="mt-5 w-full rounded-md bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-60" disabled={saving} type="submit">
            {saving ? "Salvando..." : "Salvar banner"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function BannersPage() {
  const [data, setData] = useState<PaginatedData<Banner> | null>(null);
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("");
  const [habilitado, setHabilitado] = useState("");
  const [page, setPage] = useState(1);
  const [modalBanner, setModalBanner] = useState<Banner | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest<PaginatedData<Banner>>("/api/v1/banners", {
        query: { page, limit: 50, search, tipo, habilitado },
      });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar banners");
    } finally {
      setLoading(false);
    }
  }, [habilitado, page, search, tipo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function moveBanner(from: number, to: number) {
    if (!data || from === to) return;
    const nextItems = [...data.items];
    const [moved] = nextItems.splice(from, 1);
    nextItems.splice(to, 0, moved);
    setData({ ...data, items: nextItems });
  }

  async function persistOrder() {
    if (!data?.items.length) return;
    setSavingOrder(true);
    setError("");

    try {
      await apiRequest<Banner[]>("/api/v1/banners/reorder", {
        method: "PUT",
        body: JSON.stringify({ bannerIds: data.items.map((banner) => banner.id_banner) }),
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao reordenar banners");
    } finally {
      setSavingOrder(false);
    }
  }

  async function disableBanner(banner: Banner) {
    if (!banner.id_banner) return;
    await updateResource("/api/v1/banners", banner.id_banner, { habilitado: "N" });
    await loadData();
  }

  async function removeBanner(banner: Banner) {
    if (!banner.id_banner) return;
    const confirmed = window.confirm(`Excluir banner #${banner.id_banner}?`);
    if (!confirmed) return;
    await deleteResource("/api/v1/banners", banner.id_banner);
    await loadData();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Marketing</p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">Banners</h1>
            <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
              Gerencie imagens, periodos, destinos e ordem de exibicao.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-stroke px-4 py-3 text-sm font-bold dark:border-dark-3" disabled={savingOrder} onClick={persistOrder} type="button">
              {savingOrder ? "Salvando..." : "Salvar ordem"}
            </button>
            <button className="rounded-md bg-primary px-4 py-3 text-sm font-bold text-white" onClick={() => setModalBanner(null)} type="button">
              Novo banner
            </button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <section className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        <div className="grid gap-3 border-b border-stroke p-4 dark:border-dark-3 lg:grid-cols-[1fr_190px_160px]">
          <input
            className="w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por titulo, URL ou imagem"
            value={search}
          />
          <select className="rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" onChange={(event) => setTipo(event.target.value)} value={tipo}>
            <option value="">Todos os tipos</option>
            {bannerTipos.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select className="rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white" onChange={(event) => setHabilitado(event.target.value)} value={habilitado}>
            <option value="">Todos</option>
            <option value="S">Ativos</option>
            <option value="N">Inativos</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead>
              <tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3 dark:text-dark-6">
                {["", "Imagem", "ID", "Tipo", "Versao", "Titulo", "Periodo", "Ordem", "Status", "Cliques", "Destino", "Acoes"].map((header) => (
                  <th className="px-4 py-3 font-semibold" key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={12}>Carregando banners...</td></tr>
              ) : data?.items.length ? (
                data.items.map((banner, index) => (
                  <tr
                    className={`border-b border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 ${draggedIndex === index ? "bg-primary/5" : ""}`}
                    draggable
                    key={String(banner.id_banner)}
                    onDragEnd={() => setDraggedIndex(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={() => setDraggedIndex(index)}
                    onDrop={() => {
                      if (draggedIndex !== null) moveBanner(draggedIndex, index);
                      setDraggedIndex(null);
                    }}
                  >
                    <td className="px-4 py-3">
                      <button className="flex h-10 w-8 cursor-grab items-center justify-center rounded-md border border-stroke text-dark-4 dark:border-dark-3" type="button">=</button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-20 w-44 overflow-hidden rounded-md border border-stroke bg-gray-2 dark:border-dark-3">
                        {banner.url_banner ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt={text(banner.titulo)} className="h-full w-full object-contain" src={banner.url_banner} />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold">#{banner.id_banner}</td>
                    <td className="px-4 py-3">{text(banner.tipo)}</td>
                    <td className="px-4 py-3">{text(banner.tamanho_tela)}</td>
                    <td className="max-w-[240px] px-4 py-3">
                      <p className="truncate font-semibold">{text(banner.titulo)}</p>
                      <p className="truncate text-xs text-dark-4">{text(banner.url_banner)}</p>
                    </td>
                    <td className="px-4 py-3">{dateValue(banner.data_inicial)} a {dateValue(banner.data_final)}</td>
                    <td className="px-4 py-3">{text(banner.ordem)}</td>
                    <td className="px-4 py-3"><StatusBadge value={banner.habilitado} /></td>
                    <td className="px-4 py-3">{text(banner.cliques)}</td>
                    <td className="max-w-[220px] px-4 py-3 truncate">{text(banner.url)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded-md border border-stroke px-3 py-1.5 text-xs font-bold hover:border-primary hover:text-primary dark:border-dark-3" onClick={() => setModalBanner(banner)} type="button">Editar</button>
                        <button className="rounded-md border border-stroke px-3 py-1.5 text-xs font-bold dark:border-dark-3" onClick={() => disableBanner(banner).catch((err) => setError(err instanceof Error ? err.message : "Falha ao desativar"))} type="button">Desativar</button>
                        <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50" onClick={() => removeBanner(banner).catch((err) => setError(err instanceof Error ? err.message : "Falha ao excluir"))} type="button">Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={12}>Nenhum banner encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-stroke p-4 text-sm dark:border-dark-3">
          <span className="text-dark-4 dark:text-dark-6">{data ? `${data.total} banners` : "Sem dados"}</span>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-stroke px-3 py-2 disabled:opacity-40 dark:border-dark-3" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Anterior</button>
            <span className="text-dark dark:text-white">{page} / {data?.totalPages || 1}</span>
            <button className="rounded-md border border-stroke px-3 py-2 disabled:opacity-40 dark:border-dark-3" disabled={!data || page >= data.totalPages} onClick={() => setPage((value) => value + 1)} type="button">Proxima</button>
          </div>
        </div>
      </section>

      {modalBanner !== undefined && <BannerModal banner={modalBanner} onClose={() => setModalBanner(undefined)} onSaved={loadData} />}
    </div>
  );
}
