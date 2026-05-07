"use client";

import { apiFormRequest, apiRequest } from "@/lib/api";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

type ProdutoImage = {
  filename: string;
  ordem: number;
  url: string | null;
  version?: string;
  sources?: Array<"alta" | "thumb">;
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
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [error, setError] = useState("");

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
    setOrderChanged(false);
    await onChanged?.();
  }

  async function handleUpload() {
    if (!selectedFiles?.length) return;

    setSaving(true);
    setError("");

    const formData = new FormData();
    Array.from(selectedFiles).forEach((file) => {
      formData.append("images", file);
    });

    try {
      const response = await apiFormRequest<ProdutoImage[]>(imageEndpoint, formData);
      setSelectedFiles(null);
      const input = document.getElementById(`images-${produtoId}`) as HTMLInputElement | null;
      if (input) input.value = "";
      await refreshAfterChange(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar imagens");
    } finally {
      setSaving(false);
    }
  }

  async function persistOrder() {
    setSaving(true);
    setError("");

    try {
      const response = await apiRequest<ProdutoImage[]>(`${imageEndpoint}/reorder`, {
        method: "PUT",
        body: JSON.stringify({ filenames: images.map((image) => image.filename) }),
      });
      await refreshAfterChange(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao reordenar imagens");
    } finally {
      setSaving(false);
    }
  }

  function moveImage(index: number, direction: -1 | 1) {
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
    const encoded = encodeURIComponent(image.filename);
    const baseUrl = image.url || `${imageEndpoint}/${encoded}/view?folder=thumb`;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}v=${encodeURIComponent(image.version || `${image.filename}-${image.ordem}`)}`;
  }

  async function removeImage(image: ProdutoImage) {
    const confirmed = window.confirm(`Remover ${image.filename}?`);
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const response = await apiRequest<ProdutoImage[]>(
        `${imageEndpoint}/${encodeURIComponent(image.filename)}`,
        { method: "DELETE" },
      );
      await refreshAfterChange(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover imagem");
    } finally {
      setSaving(false);
    }
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

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 rounded-md border border-stroke p-3 dark:border-dark-3">
        <input
          accept="image/*"
          className="block w-full text-sm text-dark file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white dark:text-white"
          id={`images-${produtoId}`}
          multiple
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSelectedFiles(event.target.files)}
          type="file"
        />
        <button
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
          disabled={saving || !selectedFiles?.length}
          onClick={handleUpload}
          type="button"
        >
          {saving ? "Processando..." : "Enviar imagens"}
        </button>
      </div>

      {images.length > 1 && (
        <div className="mb-4 flex flex-col gap-3 rounded-md border border-stroke bg-gray-2 p-3 dark:border-dark-3 dark:bg-dark-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-dark dark:text-white">
            {orderChanged ? "Ordem alterada. Salve para renomear no FTP." : "Arraste pela alca para reordenar."}
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

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-md border border-stroke px-4 py-6 text-center text-sm text-dark-4 dark:border-dark-3">
            Carregando imagens...
          </div>
        ) : images.length ? (
          images.map((image, index) => (
            <div
              className={`grid grid-cols-[32px_72px_1fr] gap-3 rounded-md border border-stroke p-3 transition dark:border-dark-3 ${
                draggedIndex === index ? "border-primary bg-primary/5" : ""
              }`}
              draggable
              onDragEnd={() => setDraggedIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDraggedIndex(index)}
              onDrop={() => handleDrop(index)}
              key={image.filename}
            >
              <button
                aria-label={`Arrastar ${image.filename}`}
                className="flex h-[72px] cursor-grab items-center justify-center rounded-md border border-stroke text-lg font-bold text-dark-4 active:cursor-grabbing dark:border-dark-3 dark:text-dark-6"
                type="button"
              >
                =
              </button>

              <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-md bg-gray-2 dark:bg-dark-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={image.filename}
                  className="h-full w-full object-cover"
                  src={getImageSrc(image)}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-dark dark:text-white">
                      {image.filename}
                    </p>
                    <p className="text-xs text-dark-4 dark:text-dark-6">
                      Ordem {index + 1}
                      {image.sources?.length ? ` · ${image.sources.join(" + ")}` : ""}
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-300"
                    disabled={saving}
                    onClick={() => removeImage(image)}
                    type="button"
                  >
                    Remover
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    className="rounded-md border border-stroke px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary disabled:opacity-40 dark:border-dark-3"
                    disabled={saving || index === 0}
                    onClick={() => moveImage(index, -1)}
                    type="button"
                  >
                    Subir
                  </button>
                  <button
                    className="rounded-md border border-stroke px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary disabled:opacity-40 dark:border-dark-3"
                    disabled={saving || index === images.length - 1}
                    onClick={() => moveImage(index, 1)}
                    type="button"
                  >
                    Descer
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-stroke px-4 py-6 text-center text-sm text-dark-4 dark:border-dark-3">
            Nenhuma imagem enviada.
          </div>
        )}
      </div>
    </section>
  );
}

export type ProductImagePanelRow = Row;
