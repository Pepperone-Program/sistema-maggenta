"use client";

import { Combobox } from "@base-ui/react/combobox";
import { apiRequest, type PaginatedData } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

type Option = { id: string; label: string; category?: string };
type Props = {
  endpoint: string; idField: string; nameField: string; label: string;
  excludedIds: Set<string>; value: string; onChange: (id: string) => void; disabled?: boolean;
};

export function LinkCombobox({ endpoint, idField, nameField, label, excludedIds, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open || options) return;
    const controller = new AbortController();
    setError(false);
    async function load() {
      async function allRows(path: string) {
        const rows: Record<string, unknown>[] = [];
        let totalPages = 1;
        for (let page = 1; page <= totalPages; page++) {
          const result = await apiRequest<PaginatedData<Record<string, unknown>>>(path, { query: { page, limit: 100 }, signal: controller.signal });
          rows.push(...result.items);
          totalPages = result.totalPages;
        }
        return rows;
      }
      const [rows, categories] = await Promise.all([
        allRows(endpoint),
        nameField === "subcategoria" ? allRows("/api/v1/categorias") : Promise.resolve([]),
      ]);
      const categoryNames = new Map(categories.map(category => [String(category.id_categoria), String(category.categoria || "")]));
      if (!controller.signal.aborted) setOptions(rows.map(row => {
        const name = String(row[nameField] || `#${row[idField]}`);
        const category = categoryNames.get(String(row.id_categoria));
        const categoryLabel = category || (row.id_categoria != null ? `Categoria #${row.id_categoria}` : "Categoria não informada");
        return { id: String(row[idField]), label: name, category: nameField === "subcategoria" ? categoryLabel : undefined };
      }).sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }) || a.id.localeCompare(b.id)));
    }
    load().catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [open, options, endpoint, idField, nameField, retry]);
  const available = useMemo(() => (options || []).filter(item => !excludedIds.has(item.id)), [options, excludedIds]);
  return (
    <Combobox.Root items={available} value={available.find(item => item.id === value) || null} onValueChange={item => onChange(item?.id || "")} itemToStringLabel={item => item.label} filter={(item, query) => `${item.label} ${item.category || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").includes(query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"))} isItemEqualToValue={(a, b) => a.id === b.id} open={open} onOpenChange={setOpen} openOnInputClick disabled={disabled}>
      <div className="relative min-w-0 flex-1">
        <Combobox.Input aria-label={`Buscar ${label.toLowerCase()}`} placeholder="Buscar por nome..." onFocus={() => setOpen(true)} className="h-9 w-full rounded-md border border-stroke bg-white pl-3 pr-8 text-sm outline-none focus:border-primary disabled:opacity-50 dark:border-dark-3 dark:bg-dark-2 dark:text-white" />
        <Combobox.Trigger aria-label={`Mostrar ${label.toLowerCase()}`} className="absolute inset-y-0 right-0 px-2 text-dark-4">⌄</Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-[10001]" onMouseDown={event => event.stopPropagation()}>
          <Combobox.Popup className="w-[var(--anchor-width)] min-w-56 overflow-hidden rounded-md border border-stroke bg-white p-1 shadow-lg dark:border-dark-3 dark:bg-gray-dark dark:text-white">
            {!options && !error && <div role="status" className="p-3 text-sm">Carregando opções...</div>}
            {error && <button type="button" className="p-3 text-sm text-primary" onClick={() => setRetry(current => current + 1)}>Falha ao carregar. Tentar novamente</button>}
            {options && <Combobox.Empty className="p-3 text-sm text-dark-4">Nenhum item encontrado.</Combobox.Empty>}
            <Combobox.List className="max-h-60 overflow-y-auto overscroll-contain">
              {(item: Option) => <Combobox.Item key={item.id} value={item} className="cursor-pointer rounded px-3 py-2 text-sm data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary"><span className={item.category ? "block font-semibold" : ""}>{item.label}<span className="ml-2 text-xs font-normal text-dark-4">#{item.id}</span></span>{item.category && <span className="mt-0.5 block text-xs text-dark-4 dark:text-dark-6">{item.category}</span>}</Combobox.Item>}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
