"use client";

import { apiRequest } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "./status-badge";

type UsuarioPermissao = {
  id_empresa: number;
  id_usuario: number;
  usuario: string | null;
  nome: string | null;
  email: string | null;
  ramal: string | null;
  tel: string | null;
  cel: string | null;
  cidade: string | null;
  uf: string | null;
  comissao: string | null;
  data_inicial: string | null;
  data_final: string | null;
  last_login: string | null;
  habilitado: string | null;
  last_online: string | null;
  last_ip: string | null;
  grupos: string | null;
  grupo: string | null;
};

type PermissaoOption = {
  grupo: string;
  permissao: string;
};

type UsuariosPermissoesResponse = {
  items: UsuarioPermissao[];
  permissoes: PermissaoOption[];
  total: number;
  page: number;
  limit: number;
};

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function dateText(value: unknown) {
  return value ? String(value).slice(0, 19).replace("T", " ") : "-";
}

export function AccessPage() {
  const [data, setData] = useState<UsuariosPermissoesResponse | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Record<number, string>>({});
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest<UsuariosPermissoesResponse>("/api/v1/grupos/usuarios", {
        query: { page, limit: 50, search },
      });
      setData(response);
      setSelectedGroups(
        response.items.reduce<Record<number, string>>((acc, item) => {
          acc[item.id_usuario] = item.grupo || "";
          return acc;
        }, {}),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar usuarios");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupOptions = useMemo(() => {
    const byGroup = new Map<string, string[]>();

    for (const item of data?.permissoes || []) {
      const current = byGroup.get(item.grupo) || [];
      current.push(item.permissao);
      byGroup.set(item.grupo, current);
    }

    return Array.from(byGroup.entries()).map(([grupo, permissoes]) => ({
      grupo,
      label: `${grupo} - ${permissoes.join(", ")}`,
    }));
  }, [data?.permissoes]);

  async function saveGroup(usuarioId: number) {
    const grupo = selectedGroups[usuarioId];
    if (!grupo) return;

    setSavingUserId(usuarioId);
    setError("");

    try {
      await apiRequest(`/api/v1/grupos/usuarios/${usuarioId}/grupo`, {
        method: "PUT",
        body: JSON.stringify({ grupo }),
      });
      setEditingUserId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar grupo do usuario");
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Controle de acesso
            </p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">
              Permissoes de usuarios
            </h1>
            <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
              Gerencie o grupo de permissao de qualquer usuario em uma unica tabela.
            </p>
          </div>
          <button
            className="rounded-md border border-stroke px-4 py-3 text-sm font-bold text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white"
            onClick={loadData}
            type="button"
          >
            Atualizar
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
        <div className="border-b border-stroke p-4 dark:border-dark-3">
          <input
            className="w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white lg:max-w-xl"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por ID, usuario, nome ou email"
            value={search}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead>
              <tr className="border-b border-stroke text-xs uppercase text-dark-4 dark:border-dark-3 dark:text-dark-6">
                {[
                  "ID",
                  "Usuario",
                  "Nome",
                  "Email",
                  "Contato",
                  "Periodo",
                  "Online",
                  "Status",
                  "Grupo",
                  "Acao",
                ].map((header) => (
                  <th className="px-4 py-3 font-semibold" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-dark-4" colSpan={12}>
                    Carregando usuarios...
                  </td>
                </tr>
              ) : data?.items.length ? (
                data.items.map((usuario) => {
                  const isEditing = editingUserId === usuario.id_usuario;

                  return (
                    <tr
                      className="border-b border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                      key={usuario.id_usuario}
                    >
                      <td className="px-4 py-3 font-bold">#{usuario.id_usuario}</td>
                      <td className="px-4 py-3">{text(usuario.usuario)}</td>
                      <td className="max-w-[220px] px-4 py-3">
                        <span className="block truncate font-semibold">{text(usuario.nome)}</span>
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <span className="block truncate">{text(usuario.email)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p>{text(usuario.ramal)}</p>
                          <p className="text-xs text-dark-4">{text(usuario.tel || usuario.cel)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">{dateText(usuario.data_inicial).slice(0, 10)} a {dateText(usuario.data_final).slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p>{dateText(usuario.last_online)}</p>
                          <p className="text-xs text-dark-4">{text(usuario.last_ip)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={usuario.habilitado} />
                      </td>
                      <td className="min-w-[280px] px-4 py-3">
                        {isEditing ? (
                          <select
                            className="w-full rounded-md border border-stroke bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                            onChange={(event) =>
                              setSelectedGroups((current) => ({
                                ...current,
                                [usuario.id_usuario]: event.target.value,
                              }))
                            }
                            value={selectedGroups[usuario.id_usuario] || ""}
                          >
                            <option value="">Selecione um grupo</option>
                            {groupOptions.map((option) => (
                              <option key={option.grupo} value={option.grupo}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            <p className="font-bold text-dark dark:text-white">{text(usuario.grupo)}</p>
                            <p className="text-xs text-dark-4">Todos: {text(usuario.grupos)}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                              disabled={savingUserId === usuario.id_usuario || !selectedGroups[usuario.id_usuario]}
                              onClick={() => saveGroup(usuario.id_usuario)}
                              type="button"
                            >
                              {savingUserId === usuario.id_usuario ? "Salvando..." : "Salvar"}
                            </button>
                            <button
                              className="rounded-md border border-stroke px-3 py-1.5 text-xs font-bold dark:border-dark-3"
                              onClick={() => setEditingUserId(null)}
                              type="button"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            className="rounded-md border border-stroke px-3 py-1.5 text-xs font-bold hover:border-primary hover:text-primary dark:border-dark-3"
                            onClick={() => setEditingUserId(usuario.id_usuario)}
                            type="button"
                          >
                            Editar permissao
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-dark-4" colSpan={12}>
                    Nenhum usuario encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-stroke p-4 text-sm dark:border-dark-3">
          <span className="text-dark-4 dark:text-dark-6">
            {data ? `${data.total} usuarios` : "Sem dados"}
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
              {page} / {data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1}
            </span>
            <button
              className="rounded-md border border-stroke px-3 py-2 disabled:opacity-40 dark:border-dark-3"
              disabled={!data || page >= Math.ceil(data.total / data.limit)}
              onClick={() => setPage((value) => value + 1)}
              type="button"
            >
              Proxima
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
