"use client";

import {
  apiRequest,
  createResource,
  deleteResource,
  listResource,
  updateResource,
  type PaginatedData,
} from "@/lib/api";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "./status-badge";

type Row = Record<string, unknown>;

type Contact = Row & {
  contato_email: string;
};

type FormField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: readonly string[];
};

const clientFields: FormField[] = [
  { name: "pessoa", label: "Pessoa", type: "select", options: ["J", "F"] },
  { name: "fantasia", label: "Fantasia", required: true },
  { name: "razao_social", label: "Razao social" },
  { name: "cnpj_cpf", label: "CNPJ/CPF" },
  { name: "ie_rg", label: "IE/RG" },
  { name: "email", label: "Email", type: "email" },
  { name: "site", label: "Site" },
  { name: "tel", label: "Telefone" },
  { name: "tel2", label: "Telefone 2" },
  { name: "tel3", label: "Telefone 3" },
  { name: "fax", label: "Fax" },
  { name: "endereco", label: "Endereco" },
  { name: "endereco_n", label: "Numero" },
  { name: "endereco_compl", label: "Complemento" },
  { name: "bairro", label: "Bairro" },
  { name: "cep", label: "CEP" },
  { name: "cidade", label: "Cidade" },
  { name: "uf", label: "UF" },
  { name: "pais", label: "Pais" },
  { name: "logotipo", label: "Logotipo" },
  { name: "consumidor_final", label: "Consumidor final" },
  { name: "cadastro_site", label: "Cadastro site" },
  { name: "id_transportadora", label: "Transportadora", type: "number" },
  { name: "id_vendedor", label: "Vendedor", type: "number" },
  { name: "id_captacao", label: "Captacao", type: "number" },
  { name: "ultima_venda", label: "Ultima venda", type: "date" },
  { name: "habilitado", label: "Habilitado", type: "select", options: ["S", "N"] },
  { name: "obs", label: "Observacoes", type: "textarea" },
];

const contactFields: FormField[] = [
  { name: "contato_email", label: "Email", required: true, type: "email" },
  { name: "contato_nome", label: "Nome" },
  { name: "contato_depto", label: "Departamento" },
  { name: "contato_cargo", label: "Cargo" },
  { name: "contato_tel", label: "Telefone" },
  { name: "contato_celular", label: "Celular" },
  { name: "contato_nascimento", label: "Nascimento", type: "date" },
  { name: "habilitado", label: "Habilitado", type: "select", options: ["S", "N"] },
  { name: "contato_obs", label: "Observacoes", type: "textarea" },
];

const defaultClient: Row = {
  pessoa: "J",
  pais: "BRASIL",
  habilitado: "S",
};

const emptyContact: Row = {
  habilitado: "S",
};

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function dateValue(value: unknown) {
  return value ? String(value).slice(0, 10) : "";
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return dateValue(value) || "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function normalizeValue(type: string | undefined, value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  if (type === "number") return Number(raw);
  return raw;
}

function Field({
  field,
  value,
}: {
  field: { name: string; label: string; type?: string; required?: boolean; options?: readonly string[] };
  value?: unknown;
}) {
  const inputClass =
    "w-full rounded-md border border-stroke bg-white px-3 py-2.5 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white";
  const defaultValue = field.type === "date" ? dateValue(value) : value === null || value === undefined ? "" : String(value);

  if (field.type === "textarea") {
    return <textarea className={`${inputClass} min-h-24 resize-y`} defaultValue={defaultValue} name={field.name} />;
  }

  if (field.type === "select") {
    return (
      <select className={inputClass} defaultValue={defaultValue || field.options?.[0]} name={field.name}>
        {field.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className={inputClass}
      defaultValue={defaultValue}
      name={field.name}
      placeholder={field.label}
      required={field.required}
      type={field.type || "text"}
    />
  );
}

function ContactForm({
  clienteId,
  contact,
  onSaved,
  onCancel,
}: {
  clienteId: number;
  contact: Row | null;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const values = { ...emptyContact, ...(contact || {}) };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload: Row = {};
    contactFields.forEach((field) => {
      const value = normalizeValue(field.type, form.get(field.name));
      if (value !== undefined) payload[field.name] = value;
    });

    try {
      if (contact?.contato_email) {
        await apiRequest(`/api/v1/clientes/${clienteId}/contatos/${encodeURIComponent(String(contact.contato_email))}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`/api/v1/clientes/${clienteId}/contatos`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await onSaved();
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar contato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="rounded-md border border-stroke p-4 dark:border-dark-3" onSubmit={handleSubmit}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-dark dark:text-white">{contact ? "Editar contato" : "Novo contato"}</h3>
          <p className="text-xs text-dark-4 dark:text-dark-6">Dados salvos em clientes_contatos.</p>
        </div>
        <button className="rounded-md border border-stroke px-3 py-1.5 text-xs font-semibold dark:border-dark-3" onClick={onCancel} type="button">
          Cancelar
        </button>
      </div>

      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {contactFields.map((field) => (
          <label className={field.type === "textarea" ? "block md:col-span-2 xl:col-span-4" : "block"} key={field.name}>
            <span className="mb-1 block text-xs font-bold text-dark dark:text-white">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </span>
            <Field field={field} value={values[field.name]} />
          </label>
        ))}
      </div>

      <button className="mt-4 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={saving} type="submit">
        {saving ? "Salvando..." : "Salvar contato"}
      </button>
    </form>
  );
}

function ClientModal({
  client,
  onClose,
  onSaved,
}: {
  client: Row | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"dados" | "contatos" | "orcamentos">("dados");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [budgets, setBudgets] = useState<Row[]>([]);
  const [editingContact, setEditingContact] = useState<Row | null | undefined>(undefined);
  const values = useMemo<Row>(() => ({ ...defaultClient, ...(client || {}) }), [client]);
  const clienteId = client?.id_cliente ? Number(client.id_cliente) : null;

  useEffect(() => setMounted(true), []);

  const loadContacts = useCallback(async () => {
    if (!clienteId) return;
    const response = await apiRequest<PaginatedData<Contact>>(`/api/v1/clientes/${clienteId}/contatos`, {
      query: { limit: 100 },
    });
    setContacts(response.items);
  }, [clienteId]);

  const loadBudgets = useCallback(async () => {
    if (!clienteId) return;
    const response = await apiRequest<PaginatedData<Row>>(`/api/v1/clientes/${clienteId}/orcamentos`, {
      query: { limit: 100 },
    });
    setBudgets(response.items);
  }, [clienteId]);

  useEffect(() => {
    if (tab === "contatos") loadContacts().catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar contatos"));
    if (tab === "orcamentos") loadBudgets().catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar orçamentos"));
  }, [loadBudgets, loadContacts, tab]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload: Row = {};
    clientFields.forEach((field) => {
      const value = normalizeValue(field.type, form.get(field.name));
      if (value !== undefined) payload[field.name] = value;
    });

    try {
      if (clienteId) {
        await updateResource("/api/v1/clientes", clienteId, payload);
      } else {
        await createResource("/api/v1/clientes", payload);
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar cliente");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(contact: Contact) {
    if (!clienteId) return;
    const confirmed = window.confirm(`Excluir contato ${contact.contato_email}?`);
    if (!confirmed) return;
    await apiRequest(`/api/v1/clientes/${clienteId}/contatos/${encodeURIComponent(contact.contato_email)}`, { method: "DELETE" });
    await loadContacts();
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        className="flex h-[88vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-lg bg-white shadow-2 dark:bg-gray-dark"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="border-b border-stroke px-6 py-5 dark:border-dark-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{clienteId ? `Cliente #${clienteId}` : "Novo cliente"}</p>
              <h2 className="mt-1 text-2xl font-bold text-dark dark:text-white">{text(values.fantasia) === "-" ? "Cadastro de cliente" : text(values.fantasia)}</h2>
              <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">{text(values.razao_social)} · {text(values.cidade)} / {text(values.uf)}</p>
            </div>
            <button className="rounded-md border border-stroke px-3 py-2 text-sm font-semibold dark:border-dark-3" onClick={onClose} type="button">
              Fechar
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(["dados", "contatos", "orcamentos"] as const).map((item) => (
              <button
                className={`rounded-md px-4 py-2 text-sm font-bold ${tab === item ? "bg-primary text-white" : "bg-gray-2 text-dark dark:bg-dark-2 dark:text-white"}`}
                disabled={item !== "dados" && !clienteId}
                key={item}
                onClick={() => setTab(item)}
                type="button"
              >
                {item === "dados" ? "Informações" : item === "contatos" ? "Contatos" : "Orçamentos"}
              </button>
            ))}
          </div>
        </header>

        <main className="overflow-y-auto p-6">
          {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}

          {tab === "dados" && (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {clientFields.map((field) => (
                  <label className={field.type === "textarea" ? "block md:col-span-2 xl:col-span-4" : "block"} key={field.name}>
                    <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">
                      {field.label}
                      {field.required && <span className="text-red-500"> *</span>}
                    </span>
                    <Field field={field} value={values[field.name]} />
                  </label>
                ))}
              </div>

              <div className="grid gap-3 rounded-md border border-stroke p-4 text-sm dark:border-dark-3 md:grid-cols-3">
                <div>
                  <span className="block text-xs font-bold uppercase text-dark-4">Data inclusao</span>
                  <span className="font-semibold text-dark dark:text-white">{text(values.data_inclusao)}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase text-dark-4">Ultima venda</span>
                  <span className="font-semibold text-dark dark:text-white">{text(values.ultima_venda)}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase text-dark-4">Empresa</span>
                  <span className="font-semibold text-dark dark:text-white">{text(values.id_empresa)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button className="rounded-md border border-stroke px-4 py-2.5 text-sm font-bold dark:border-dark-3" onClick={onClose} type="button">
                  Cancelar
                </button>
                <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={saving} type="submit">
                  {saving ? "Salvando..." : "Salvar cliente"}
                </button>
              </div>
            </form>
          )}

          {tab === "contatos" && clienteId && (
            <div className="space-y-4">
              {editingContact !== undefined ? (
                <ContactForm clienteId={clienteId} contact={editingContact} onCancel={() => setEditingContact(undefined)} onSaved={loadContacts} />
              ) : (
                <button className="rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-white" onClick={() => setEditingContact(null)} type="button">
                  Novo contato
                </button>
              )}

              <div className="overflow-x-auto rounded-md border border-stroke dark:border-dark-3">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3">
                      {["Nome", "Email", "Departamento", "Cargo", "Telefone", "Celular", "Nascimento", "Status", "Acoes"].map((header) => (
                        <th className="px-4 py-3 font-semibold" key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.length ? contacts.map((contact) => (
                      <tr className="border-b border-stroke dark:border-dark-3" key={contact.contato_email}>
                        <td className="px-4 py-3 font-semibold text-dark dark:text-white">{text(contact.contato_nome)}</td>
                        <td className="px-4 py-3">{text(contact.contato_email)}</td>
                        <td className="px-4 py-3">{text(contact.contato_depto)}</td>
                        <td className="px-4 py-3">{text(contact.contato_cargo)}</td>
                        <td className="px-4 py-3">{text(contact.contato_tel)}</td>
                        <td className="px-4 py-3">{text(contact.contato_celular)}</td>
                        <td className="px-4 py-3">{dateValue(contact.contato_nascimento)}</td>
                        <td className="px-4 py-3"><StatusBadge value={contact.habilitado} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button className="rounded-md border border-stroke px-3 py-1.5 text-xs font-bold dark:border-dark-3" onClick={() => setEditingContact(contact)} type="button">Editar</button>
                            <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600" onClick={() => deleteContact(contact).catch((err) => setError(err instanceof Error ? err.message : "Falha ao excluir contato"))} type="button">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={9}>Nenhum contato cadastrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "orcamentos" && (
            <div className="overflow-x-auto rounded-md border border-stroke dark:border-dark-3">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead>
                  <tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3">
                    {["ID", "Data", "Fantasia", "Contato", "Email", "Telefone", "Cidade", "UF", "Nivel", "Entrega", "Status"].map((header) => (
                      <th className="px-4 py-3 font-semibold" key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {budgets.length ? budgets.map((budget) => (
                    <tr className="border-b border-stroke dark:border-dark-3" key={String(budget.id_orcamento)}>
                      <td className="px-4 py-3 font-bold text-dark dark:text-white">#{text(budget.id_orcamento)}</td>
                      <td className="px-4 py-3">{formatDate(budget.data_orcamento)}</td>
                      <td className="px-4 py-3">{text(budget.fantasia)}</td>
                      <td className="px-4 py-3">{text(budget.contato)}</td>
                      <td className="px-4 py-3">{text(budget.email)}</td>
                      <td className="px-4 py-3">{text(budget.tel)}</td>
                      <td className="px-4 py-3">{text(budget.cidade)}</td>
                      <td className="px-4 py-3">{text(budget.uf)}</td>
                      <td className="px-4 py-3">{text(budget.nivel)}</td>
                      <td className="px-4 py-3">{text(budget.entrega)}</td>
                      <td className="px-4 py-3">{text(budget.cancelamento || budget.data_finalizado || "Em aberto")}</td>
                    </tr>
                  )) : (
                    <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={11}>Nenhum orçamento encontrado para este cliente.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );

  return mounted ? createPortal(modal, document.body) : null;
}

export function ClientsPage() {
  const [data, setData] = useState<PaginatedData<Row> | null>(null);
  const [search, setSearch] = useState("");
  const [habilitado, setHabilitado] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalClient, setModalClient] = useState<Row | null | undefined>(undefined);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await listResource<Row>("/api/v1/clientes", { page, limit: 12, search, habilitado });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar clientes");
    } finally {
      setLoading(false);
    }
  }, [habilitado, page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function removeClient(row: Row) {
    const confirmed = window.confirm(`Excluir cliente #${String(row.id_cliente)}?`);
    if (!confirmed) return;
    await deleteResource("/api/v1/clientes", String(row.id_cliente));
    await loadData();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">CRM</p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">Clientes</h1>
            <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
              Cadastro completo, contatos e histórico de orçamentos em um único modal.
            </p>
          </div>
          <button className="rounded-md bg-primary px-4 py-3 text-sm font-bold text-white" onClick={() => setModalClient(null)} type="button">
            Novo cliente
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
            placeholder="Buscar por fantasia, razao social, documento, email ou cidade"
            value={search}
          />
          <select
            className="rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead>
              <tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3 dark:text-dark-6">
                {["ID", "Razao social", "Documento", "Cidade", "UF", "Telefone", "Email", "Status", "Acoes"].map((header) => (
                  <th className="px-4 py-3 font-semibold" key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={11}>Carregando clientes...</td></tr>
              ) : data?.items.length ? (
                data.items.map((row) => (
                  <tr className="border-b border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2" key={String(row.id_cliente)}>
                    <td className="px-4 py-3 font-bold">#{text(row.id_cliente)}</td>
                    <td className="max-w-[300px] px-4 py-3"><span className="block truncate">{text(row.razao_social)}</span></td>
                    <td className="px-4 py-3">{text(row.cnpj_cpf)}</td>
                    <td className="px-4 py-3">{text(row.cidade)}</td>
                    <td className="px-4 py-3">{text(row.uf)}</td>
                    <td className="px-4 py-3">{text(row.tel)}</td>
                    <td className="max-w-[240px] px-4 py-3"><span className="block truncate">{text(row.email)}</span></td>
                    <td className="px-4 py-3"><StatusBadge value={row.habilitado} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="rounded-md border border-stroke px-3 py-1.5 text-xs font-bold hover:border-primary hover:text-primary dark:border-dark-3" onClick={() => setModalClient(row)} type="button">
                          Editar
                        </button>
                        <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50" onClick={() => removeClient(row).catch((err) => setError(err instanceof Error ? err.message : "Falha ao excluir"))} type="button">
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td className="px-4 py-8 text-center text-dark-4" colSpan={11}>Nenhum cliente encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-stroke p-4 text-sm dark:border-dark-3">
          <span className="text-dark-4 dark:text-dark-6">{data ? `${data.total} clientes` : "Sem dados"}</span>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-stroke px-3 py-2 disabled:opacity-40 dark:border-dark-3" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Anterior</button>
            <span className="text-dark dark:text-white">{page} / {data?.totalPages || 1}</span>
            <button className="rounded-md border border-stroke px-3 py-2 disabled:opacity-40 dark:border-dark-3" disabled={!data || page >= data.totalPages} onClick={() => setPage((value) => value + 1)} type="button">Proxima</button>
          </div>
        </div>
      </section>

      {modalClient !== undefined && <ClientModal client={modalClient} onClose={() => setModalClient(undefined)} onSaved={loadData} />}
    </div>
  );
}
