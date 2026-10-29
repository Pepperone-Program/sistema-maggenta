"use client";

import { FeedbackToast, toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, RefreshCw, Pencil, Trash2 } from "lucide-react";

import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
  type PaginatedData,
} from "@/lib/api";
import type { ResourceConfig, ResourceField } from "@/types/admin";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "./status-badge";
import { ProductImagesPanel } from "./product-images-panel";

type Row = Record<string, unknown>;

function normalizeValue(field: ResourceField, value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (raw === "") return field.emptyAsNull ? null : undefined;
  if (field.type === "number") return Number(raw);
  return raw;
}

function formatCell(value: unknown, field: ResourceField) {
  if (field.name === "habilitado" || field.name === "site" || field.name === "promocao") {
    return <StatusBadge value={value} />;
  }

  if (value === null || value === undefined || value === "") return "-";

  const text = String(value);
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

function FieldControl({
  field,
  value,
}: {
  field: ResourceField;
  value?: unknown;
}) {
  const baseClass =
    "w-full rounded-md border border-stroke bg-gray-2 px-3 py-2 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white";
  const defaultValue =
    value === undefined || value === null
      ? ""
      : field.type === "date"
        ? String(value).slice(0, 10)
        : String(value);

  if (field.type === "textarea") {
    return (
      <textarea
        className={`${baseClass} min-h-24 resize-y`}
        defaultValue={defaultValue}
        maxLength={field.maxLength}
        name={field.name}
        required={field.required}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        className={baseClass}
        defaultValue={defaultValue || field.options?.[0]?.value}
        name={field.name}
        required={field.required}
      >
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Input
      className={baseClass}
      defaultValue={defaultValue}
      maxLength={field.maxLength}
      name={field.name}
      placeholder={field.label}
      required={field.required}
      type={field.type || "text"}
    />
  );
}

export function ResourcePage({ config, onRowClick }: { config: ResourceConfig; onRowClick?: (row: Row) => void }) {
  const [data, setData] = useState<PaginatedData<Row> | null>(null);
  const [search, setSearch] = useState("");
  const [habilitado, setHabilitado] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const formValues = useMemo(
    () => ({ ...(config.defaultValues || {}), ...(selected || {}) }),
    [config.defaultValues, selected],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await listResource<Row>(config.endpoint, {
        page,
        limit: 10,
        search,
        habilitado,
      });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, habilitado, page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = config.formFields.reduce<Record<string, unknown>>((acc, field) => {
      const value = normalizeValue(field, formData.get(field.name));
      if (value !== undefined) acc[field.name] = value;
      return acc;
    }, {});

    try {
      if (selected) {
        await updateResource(config.endpoint, String(selected[config.idField]), payload);
      } else {
        await createResource(config.endpoint, payload);
      }

      toast.add({ type: "success", description: selected ? "Alterações salvas." : "Registro criado." });
      setFormOpen(false);
      setSelected(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: Row) {
    const id = row[config.idField];
    if (!id) return;

    const confirmed = window.confirm(`Excluir ${config.title.toLowerCase()} #${String(id)}?`);
    if (!confirmed) return;

    try {
      await deleteResource(config.endpoint, String(id));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Maggenta Admin
            </p>
            <h1 className="mt-2 text-2xl font-bold text-dark dark:text-white">
              {config.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-dark-4 dark:text-dark-6">
              {config.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { if (page === 1) loadData(); else setPage(1); }}><RefreshCw className="size-4" /> Atualizar</Button>
            <Button onClick={() => { setSelected(null); setFormOpen(true); }}><Plus className="size-4" /> Criar</Button>
          </div>
        </div>
      </div>

      <FeedbackToast message={error} type="error" />

      <div>
        <section className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
          <div className="flex flex-col gap-3 border-b border-stroke p-3 dark:border-dark-3 md:flex-row md:items-center md:justify-between">
            <Input
              className="md:max-w-md"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={config.searchPlaceholder}
              value={search}
            />
            {config.showStatusFilter !== false && (
              <select
                className="rounded-md border border-stroke bg-gray-2 px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                onChange={(event) => {
                  setHabilitado(event.target.value);
                  setPage(1);
                }}
                value={habilitado}
              >
                <option value="">Todos</option>
                <option value="S">Ativos</option>
                <option value="N">Inativos</option>
              </select>
            )}
          </div>

          <Table className="text-left">
              <TableHeader>
                <TableRow className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3 dark:text-dark-6">
                  {config.columns.map((column) => (
                    <TableHead className="px-3 py-2 font-semibold" key={column.name}>
                      {column.label}
                    </TableHead>
                  ))}
                  <TableHead className="px-4 py-3 text-right font-semibold">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell className="px-4 py-8 text-center text-dark-4" colSpan={config.columns.length + 1}>
                      Carregando dados...
                    </TableCell>
                  </TableRow>
                ) : data?.items.length ? (
                  data.items.map((row) => (
                    <TableRow
                      className={`border-b border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 ${onRowClick ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" : ""}`}
                      key={String(row[config.idField])}
                      onClick={() => onRowClick?.(row)}
                      tabIndex={onRowClick ? 0 : undefined}
                      onKeyDown={onRowClick ? (event) => {
                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      } : undefined}
                    >
                      {config.columns.map((column) => (
                        <TableCell className="max-w-[280px] px-4 py-3" key={column.name}>
                          {formatCell(row[column.name], column)}
                        </TableCell>
                      ))}
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-md border border-stroke px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary dark:border-dark-3"
                            onClick={(event) => { event.stopPropagation(); setSelected(row); setFormOpen(true); }}
                            type="button"
                          >
                            <Pencil aria-hidden="true" className="mr-1 inline size-3.5" /> Editar
                          </button>
                          <button
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300"
                            onClick={(event) => { event.stopPropagation(); handleDelete(row); }}
                            type="button"
                          >
                            <Trash2 aria-hidden="true" className="mr-1 inline size-3.5" /> Excluir
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="px-4 py-8 text-center text-dark-4" colSpan={config.columns.length + 1}>
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
</Table>

          <div className="flex items-center justify-between border-t border-stroke p-4 text-sm dark:border-dark-3">
            <span className="text-dark-4 dark:text-dark-6">
              {data ? `${data.total} registros` : "Sem dados"}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-stroke px-3 py-2 disabled:opacity-40 dark:border-dark-3"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                type="button"
              >
                Anterior
              </button>
              <span className="text-dark dark:text-white">
                {page} / {data?.totalPages || 1}
              </span>
              <button
                className="rounded-md border border-stroke px-3 py-2 disabled:opacity-40 dark:border-dark-3"
                disabled={!data || page >= data.totalPages}
                onClick={() => setPage((value) => value + 1)}
                type="button"
              >
                Proxima
              </button>
            </div>
          </div>
        </section>

      </div>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!saving) { setFormOpen(open); if (!open) setSelected(null); } }}>
        <DialogContent>
          <DialogTitle className="pr-8 text-lg font-bold">{selected ? "Editar registro" : "Criar registro"}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-dark-4 dark:text-dark-6">{config.title}</DialogDescription>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit} key={selected ? String(selected[config.idField]) : "new"}>
            {config.formFields.map((field) => (
              <label className={field.type === "textarea" ? "block sm:col-span-2" : "block"} key={field.name}>
                <span className="mb-1 block text-sm font-semibold text-dark dark:text-white">{field.label}{field.required && <span className="text-red-500"> *</span>}</span>
                <FieldControl field={field} value={formValues[field.name]} />
              </label>
            ))}
            <div className="flex justify-end gap-2 border-t border-stroke pt-3 sm:col-span-2 dark:border-dark-3">
              <Button variant="outline" disabled={saving} onClick={() => { setFormOpen(false); setSelected(null); }}>Cancelar</Button>
              <Button disabled={saving} type="submit">{saving ? "Salvando..." : selected ? "Salvar alterações" : "Criar registro"}</Button>
            </div>
          </form>
          {config.imageManager && selected && <ProductImagesPanel endpoint={config.endpoint} onChanged={loadData} produtoId={String(selected[config.idField])} produtoNome={selected.produto} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

