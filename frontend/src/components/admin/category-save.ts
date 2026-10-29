export type CategorySaveData = { id_categoria?: number; url_capa?: string | null };

/** Persist the record first; keep its ID available even if the cover upload fails. */
export async function saveCategoryWithCover<T extends CategorySaveData>(options: {
  id: number | null;
  cover: File | null;
  save: (id: number | null) => Promise<T>;
  upload: (id: number, file: File) => Promise<T>;
  onPersisted: (id: number) => void;
}): Promise<T> {
  const saved = await options.save(options.id);
  const id = options.id || Number(saved.id_categoria);
  if (!id) throw new Error("Categoria salva, mas não foi possível identificar o registro para enviar a capa.");
  options.onPersisted(id);
  if (!options.cover) return saved;
  try {
    const updated = await options.upload(id, options.cover);
    if (!updated.url_capa) throw new Error("O envio não retornou a URL da capa.");
    return updated;
  } catch (error) {
    throw new Error(`Os dados da categoria foram salvos, mas a capa não foi enviada: ${error instanceof Error ? error.message : "tente novamente"}. Tente salvar novamente.`);
  }
}
