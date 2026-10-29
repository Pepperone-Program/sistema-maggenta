"use client";

import { FeedbackToast, toast } from "@/components/ui/toast";

import { apiFormRequest, apiRequest } from "@/lib/api";
import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, Trash2 } from "lucide-react";

type ProdutoImage = {
  id_imagem: number;
  id_produto: number;
  url_imagem: string;
  ordem_imagem: number;
  filename: string;
  ordem: number;
  url: string;
  version?: string;
  sources?: Array<"database">;
};

type Row = Record<string, unknown>;

type Props = {
  endpoint: string;
  produtoId: string | number;
  produtoNome?: unknown;
  onChanged?: () => Promise<void> | void;
};

export function ProductImagesPanel({ endpoint, produtoId, produtoNome, onChanged }: Props) {
  const [images, setImages] = useState<ProdutoImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const deleting = useRef(false);

  const imageEndpoint = useMemo(
    () => `${endpoint}/${produtoId}/images`,
    [endpoint, produtoId],
  );

  const loadImages = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest<ProdutoImage[]>(imageEndpoint);
      setImages(response);
      setSelectedIds(current => new Set([...current].filter(id => response.some(image => image.id_imagem === id))));
      setOrderChanged(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar imagens");
    } finally {
      setLoading(false);
    }
  }, [imageEndpoint]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  async function refreshAfterChange(nextImages: ProdutoImage[]) {
    setImages(nextImages);
    setSelectedIds(current => new Set([...current].filter(id => nextImages.some(image => image.id_imagem === id))));
    setOrderChanged(false);
    await onChanged?.();
  }

  async function persistOrder() {
    setSaving(true);
    setError("");

    try {
      const response = await apiRequest<ProdutoImage[]>(`${imageEndpoint}/reorder`, {
        method: "PUT",
        body: JSON.stringify({ imageIds: images.map((image) => image.id_imagem) }),
      });
      await refreshAfterChange(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao reordenar imagens");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(files = selectedFiles) {
    if (!files.length || saving || deleting.current) return;

    setSaving(true);
    setError("");

    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));

    try {
      const response = await apiFormRequest<ProdutoImage[]>(imageEndpoint, formData);
      setSelectedFiles([]);
      await refreshAfterChange(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar imagens");
    } finally {
      setSaving(false);
    }
  }

  async function removeImage(image: ProdutoImage) {
    if (saving || deleting.current) return;
    const confirmed = window.confirm(`Remover ${image.filename}?`);
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const response = await apiRequest<ProdutoImage[]>(
        `${imageEndpoint}/${encodeURIComponent(String(image.id_imagem))}`,
        { method: "DELETE" },
      );
      await refreshAfterChange(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover imagem");
    } finally {
      setSaving(false);
    }
  }

  async function removeSelectedImages() {
    if (saving || deleting.current || !selectedIds.size) return;
    if (!window.confirm(`Excluir ${selectedIds.size} imagem(ns) selecionada(s)? Esta ação não pode ser desfeita.`)) return;
    deleting.current = true;
    setSaving(true);
    setError("");
    let removed = 0;
    try {
      // The existing delete endpoint reorders the remaining images. Keep requests sequential.
      for (const id of selectedIds) {
        const remaining = await apiRequest<ProdutoImage[]>(`${imageEndpoint}/${encodeURIComponent(String(id))}`, { method: "DELETE" });
        removed++;
        setImages(remaining);
        setOrderChanged(false);
        setSelectedIds(current => new Set([...current].filter(selected => remaining.some(image => image.id_imagem === selected))));
      }
      setSelecting(false);
      toast.add({ type: "success", description: `${removed} imagem(ns) excluída(s).` });
    } catch (err) {
      // A failed response can still follow a completed deletion. Reconcile before retrying.
      try {
        const remaining = await apiRequest<ProdutoImage[]>(imageEndpoint);
        setImages(remaining);
        setOrderChanged(false);
        setSelectedIds(current => new Set([...current].filter(id => remaining.some(image => image.id_imagem === id))));
      } catch { /* Keep the last confirmed state when the connection is unavailable. */ }
      setError(`${removed} imagem(ns) excluída(s). ${err instanceof Error ? err.message : "Falha ao excluir imagens"}. Confira as imagens restantes antes de tentar novamente.`);
    } finally {
      try { if (removed) await onChanged?.(); }
      catch { toast.add({ type: "error", description: "As imagens foram excluídas, mas não foi possível atualizar a lista de produtos." }); }
      deleting.current = false;
      setSaving(false);
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(event.target.files || []));
  }

  function handleDropFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    if (saving || deleting.current) return;
    const files = Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith("image/"));
    setSelectedFiles(files);
    handleUpload(files);
  }

  function moveImage(index: number, direction: -1 | 1) {
    if (saving || selecting) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const nextImages = [...images];
    const current = nextImages[index];
    nextImages[index] = nextImages[targetIndex];
    nextImages[targetIndex] = current;
    setImages(nextImages);
    setOrderChanged(true);
  }

  function handleDrop(targetIndex: number) {
    if (saving || selecting) return;
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const nextImages = [...images];
    const [moved] = nextImages.splice(draggedIndex, 1);
    nextImages.splice(targetIndex, 0, moved);
    setImages(nextImages);
    setOrderChanged(true);
    setDraggedIndex(null);
  }

  function getImageSrc(image: ProdutoImage) {
    const baseUrl = image.url || image.url_imagem;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}v=${encodeURIComponent(image.version || `${image.id_imagem}-${image.ordem_imagem}`)}`;
  }

  return (
    <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Produto #{produtoId}
        </p>
        <h2 className="mt-1 text-lg font-bold text-dark dark:text-white">
          Imagens do produto
        </h2>
        <p className="text-sm text-dark-4 dark:text-dark-6">
          {String(produtoNome || "Produto selecionado")}
        </p>
      </div>

      <FeedbackToast message={error} type="error" />

      <div
        className={`mb-4 rounded-md border border-dashed p-4 transition ${
          dragActive ? "border-primary bg-primary/5" : "border-stroke bg-gray-2 dark:border-dark-3 dark:bg-dark-2"
        }`}
        onDragLeave={() => setDragActive(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDrop={handleDropFiles}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-dark dark:text-white">Adicionar imagens</p>
            <p className="text-xs text-dark-4 dark:text-dark-6">
              Arraste arquivos aqui ou selecione novas imagens para enviar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-md border border-stroke bg-white px-3 py-2 text-xs font-semibold text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white">
              Escolher arquivos
              <input accept="image/*" className="hidden" multiple disabled={saving} onChange={handleFileInput} type="file" />
            </label>
            <button
              className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              disabled={saving || !selectedFiles.length}
              onClick={() => handleUpload()}
              type="button"
            >
              {saving ? "Processando..." : `Enviar${selectedFiles.length ? ` (${selectedFiles.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>

      {images.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={saving || loading} onClick={() => { setSelecting(!selecting); setSelectedIds(new Set()); }} className="rounded-md border border-stroke px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-dark-3">{selecting ? "Cancelar seleção" : "Selecionar imagens"}</button>
          {selecting && <>
            <button type="button" disabled={saving} onClick={() => setSelectedIds(selectedIds.size === images.length ? new Set() : new Set(images.map(image => image.id_imagem)))} className="rounded-md border border-stroke px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-dark-3">{selectedIds.size === images.length ? "Desmarcar todas" : "Selecionar todas"}</button>
            <button type="button" disabled={saving || !selectedIds.size} onClick={removeSelectedImages} className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Processando..." : `Excluir selecionadas (${selectedIds.size})`}</button>
          </>}
        </div>
      )}

      {images.length > 1 && !selecting && (
        <div className="mb-4 flex flex-col gap-3 rounded-md border border-stroke bg-gray-2 p-3 dark:border-dark-3 dark:bg-dark-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-dark dark:text-white">
            {orderChanged ? "Ordem alterada. Salve para aplicar." : "Arraste as imagens ou use as setas para reordenar."}
          </span>
          <button
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
            disabled={saving || !orderChanged}
            onClick={persistOrder}
            type="button"
          >
            {saving ? "Salvando..." : "Salvar ordem"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full rounded-md border border-stroke px-4 py-6 text-center text-sm text-dark-4 dark:border-dark-3">
            Carregando imagens...
          </div>
        ) : images.length ? (
          images.map((image, index) => (
            <div
              className={`min-w-0 overflow-hidden rounded-md border bg-white transition dark:bg-gray-dark ${
                draggedIndex === index || selectedIds.has(image.id_imagem) ? "border-primary ring-1 ring-primary/30" : "border-stroke dark:border-dark-3"
              }`}
              draggable={!saving && !selecting}
              onDragEnd={() => setDraggedIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDraggedIndex(index)}
              onDrop={() => handleDrop(index)}
              key={image.id_imagem}
            >
              <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gray-2 dark:bg-dark-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={image.filename}
                  className="h-full w-full object-contain"
                  src={getImageSrc(image)}
                  loading="lazy"
                />
                <span className="absolute bottom-2 left-2 rounded bg-white/95 px-2 py-1 text-[10px] font-semibold text-dark shadow-sm dark:bg-gray-dark dark:text-white">{index === 0 ? "Principal" : `Ordem ${index + 1}`}</span>
                {selecting ? <label className="absolute right-2 top-2 flex cursor-pointer items-center rounded bg-white p-1.5 shadow dark:bg-gray-dark">
                  <input type="checkbox" aria-label={`Selecionar ${image.filename}`} checked={selectedIds.has(image.id_imagem)} disabled={saving} onChange={event => setSelectedIds(current => { const next = new Set(current); if (event.target.checked) next.add(image.id_imagem); else next.delete(image.id_imagem); return next; })} className="h-4 w-4 accent-primary" />
                </label> : <span aria-hidden="true" className="absolute right-2 top-2 cursor-grab rounded bg-white/95 p-1 text-dark-4 shadow-sm active:cursor-grabbing dark:bg-gray-dark dark:text-dark-6"><GripVertical className="size-4" /></span>}
              </div>

              <div className="min-w-0 p-2">
                <p className="truncate text-xs font-semibold text-dark dark:text-white" title={image.filename}>{image.filename}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    aria-label={`Mover ${image.filename} para antes`}
                    title="Mover para antes"
                    className="rounded-md border border-stroke p-1.5 text-dark-4 hover:border-primary hover:text-primary disabled:opacity-40 dark:border-dark-3 dark:text-dark-6"
                    disabled={saving || selecting || index === 0}
                    onClick={() => moveImage(index, -1)}
                    type="button"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <button
                    aria-label={`Mover ${image.filename} para depois`}
                    title="Mover para depois"
                    className="rounded-md border border-stroke p-1.5 text-dark-4 hover:border-primary hover:text-primary disabled:opacity-40 dark:border-dark-3 dark:text-dark-6"
                    disabled={saving || selecting || index === images.length - 1}
                    onClick={() => moveImage(index, 1)}
                    type="button"
                  >
                    <ArrowRight className="size-4" />
                  </button>
                  <button
                    aria-label={`Excluir ${image.filename}`}
                    title="Excluir imagem"
                    className="ml-auto rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-500/30 dark:text-red-300"
                    disabled={saving || selecting}
                    onClick={() => removeImage(image)}
                    type="button"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-md border border-stroke px-4 py-6 text-center text-sm text-dark-4 dark:border-dark-3">
            Nenhuma imagem cadastrada para este produto.
          </div>
        )}
      </div>
    </section>
  );
}

export type ProductImagePanelRow = Row;
