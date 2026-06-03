"use client";

import { apiRequest } from "@/lib/api";
import { FormEvent, useEffect, useState } from "react";
import { StatusBadge } from "./status-badge";

type Contato = {
  id_cliente: number;
  contato_email: string;
  contato_nome: string | null;
  contato_cargo: string | null;
  contato_tel: string | null;
  contato_celular: string | null;
  habilitado: string;
};

type Cliente = {
  id_cliente: number;
  fantasia?: string | null;
  razao_social?: string | null;
  email?: string | null;
};

function clienteLabel(cliente: Cliente) {
  return cliente.fantasia || cliente.razao_social || `Cliente #${cliente.id_cliente}`;
}

function ClientSearch({
  value,
  onChange,
}: {
  value: Cliente | null;
  onChange: (cliente: Cliente | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await apiRequest<{ items: Cliente[] }>("/api/v1/clientes", {
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
  }, [search]);

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-dark dark:text-white">
          Cliente
        </span>
        <input
          className="w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
          onChange={(event) => {
            setSearch(event.target.value);
            onChange(null);
          }}
          placeholder="Buscar cliente por nome"
          value={value ? clienteLabel(value) : search}
        />
      </label>
      <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-stroke bg-white dark:border-dark-3 dark:bg-dark-2">
        {loading ? (
          <div className="px-3 py-2 text-sm text-dark-4">Buscando...</div>
        ) : items.length ? (
          items.map((cliente) => (
            <button
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-2 dark:hover:bg-dark-3"
              key={cliente.id_cliente}
              onClick={() => {
                onChange(cliente);
                setSearch("");
              }}
              type="button"
            >
              <span>
                <span className="block font-medium text-dark dark:text-white">
                  {clienteLabel(cliente)}
                </span>
                {cliente.email && <span className="text-xs text-dark-4">{cliente.email}</span>}
              </span>
              <span className="shrink-0 text-xs text-dark-4">#{cliente.id_cliente}</span>
            </button>
          ))
        ) : (
          <div className="px-3 py-2 text-sm text-dark-4">Nenhum cliente encontrado</div>
        )}
      </div>
    </div>
  );
}

export function ClientContactsPage() {
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(cliente = selectedCliente) {
    if (!cliente) return;
    setError("");
    setMessage("");

    try {
      const data = await apiRequest<{ items: Contato[] }>(
        `/api/v1/clientes/${cliente.id_cliente}/contatos`,
        { query: { limit: 100 } },
      );
      setContatos(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar contatos");
    }
  }

  async function createContato(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCliente) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      contato_email: String(form.get("contato_email") || "").trim(),
      contato_nome: String(form.get("contato_nome") || "").trim(),
      contato_cargo: String(form.get("contato_cargo") || "").trim(),
      contato_tel: String(form.get("contato_tel") || "").trim(),
      contato_celular: String(form.get("contato_celular") || "").trim(),
      habilitado: String(form.get("habilitado") || "S"),
    };

    try {
      await apiRequest(`/api/v1/clientes/${selectedCliente.id_cliente}/contatos`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMessage("Contato criado com sucesso.");
      event.currentTarget.reset();
      load(selectedCliente);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar contato");
    }
  }

  async function removeContato(email: string) {
    if (!selectedCliente) return;
    try {
      await apiRequest(
        `/api/v1/clientes/${selectedCliente.id_cliente}/contatos/${encodeURIComponent(email)}`,
        { method: "DELETE" },
      );
      setMessage("Contato removido com sucesso.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover contato");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Clientes
        </p>
        <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">
          Contatos de clientes
        </h1>
        <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
          Consulte e mantenha os contatos vinculados a cada cliente.
        </p>
      </div>

      {(message || error) && (
        <div
          className={
            error
              ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              : "rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700"
          }
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <aside className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
          <form onSubmit={createContato} className="space-y-4">
            <ClientSearch value={selectedCliente} onChange={setSelectedCliente} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Email</span>
              <input className="w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 dark:border-dark-3 dark:bg-dark-2" name="contato_email" placeholder="email@cliente.com" required type="email" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Nome</span>
              <input className="w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 dark:border-dark-3 dark:bg-dark-2" name="contato_nome" placeholder="Nome do contato" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Cargo</span>
              <input className="w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 dark:border-dark-3 dark:bg-dark-2" name="contato_cargo" placeholder="Cargo do contato" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="rounded-md border border-stroke bg-gray-2 px-4 py-3 dark:border-dark-3 dark:bg-dark-2" name="contato_tel" placeholder="Telefone" />
              <input className="rounded-md border border-stroke bg-gray-2 px-4 py-3 dark:border-dark-3 dark:bg-dark-2" name="contato_celular" placeholder="Celular" />
            </div>
            <select className="w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 dark:border-dark-3 dark:bg-dark-2" name="habilitado" defaultValue="S">
              <option value="S">Ativo</option>
              <option value="N">Inativo</option>
            </select>
            <button className="w-full rounded-md bg-primary px-4 py-3 text-sm font-bold text-white">
              Criar contato
            </button>
          </form>
        </aside>

        <section className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
          <div className="flex flex-col gap-3 border-b border-stroke p-4 dark:border-dark-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <ClientSearch value={selectedCliente} onChange={setSelectedCliente} />
            </div>
            <button
              className="rounded-md bg-primary px-4 py-3 text-sm font-bold text-white"
              onClick={() => load()}
              type="button"
            >
              Carregar contatos
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-dark-4 dark:text-dark-6">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {contatos.map((contato) => (
                  <tr className="border-t border-stroke dark:border-dark-3" key={contato.contato_email}>
                    <td className="px-4 py-3 font-semibold text-dark dark:text-white">
                      {contato.contato_nome || "-"}
                    </td>
                    <td className="px-4 py-3">{contato.contato_email}</td>
                    <td className="px-4 py-3">{contato.contato_cargo || "-"}</td>
                    <td className="px-4 py-3">{contato.contato_tel || contato.contato_celular || "-"}</td>
                    <td className="px-4 py-3"><StatusBadge value={contato.habilitado} /></td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-sm font-semibold text-red-600" onClick={() => removeContato(contato.contato_email)} type="button">
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
