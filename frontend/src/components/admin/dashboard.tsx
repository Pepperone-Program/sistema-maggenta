"use client";

import { apiRequest, listResource, type PaginatedData } from "@/lib/api";
import type { EstatisticasResumo, ProdutoRanking } from "@/types/admin";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type AnyRow = Record<string, unknown>;

type DashboardState = {
  estatisticas: EstatisticasResumo | null;
  produtos: PaginatedData<AnyRow> | null;
  clientes: PaginatedData<AnyRow> | null;
  orcamentos: PaginatedData<AnyRow> | null;
  categorias: PaginatedData<AnyRow> | null;
};

const initialState: DashboardState = {
  estatisticas: null,
  produtos: null,
  clientes: null,
  orcamentos: null,
  categorias: null,
};

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
      <p className="text-sm font-medium text-dark-4 dark:text-dark-6">{label}</p>
      <strong className="mt-3 block text-3xl font-bold text-dark dark:text-white">
        {value}
      </strong>
      <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">{detail}</p>
    </div>
  );
}

function RankingTable({
  title,
  data,
}: {
  title: string;
  data: ProdutoRanking[];
}) {
  return (
    <div className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
      <div className="border-b border-stroke px-5 py-4 dark:border-dark-3">
        <h2 className="text-lg font-bold text-dark dark:text-white">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-dark-4 dark:text-dark-6">
              <th className="px-5 py-3">Produto</th>
              <th className="px-5 py-3">Codigo</th>
              <th className="px-5 py-3 text-right">Qtde</th>
            </tr>
          </thead>
          <tbody>
            {data.length ? (
              data.map((item) => (
                <tr
                  className="border-t border-stroke text-dark dark:border-dark-3 dark:text-white"
                  key={`${item.id_produto}-${title}`}
                >
                  <td className="max-w-[360px] px-5 py-3">
                    <span className="font-semibold">
                      {item.produto || `Produto #${item.id_produto}`}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-dark-4 dark:text-dark-6">
                    {item.codigo || "-"}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-primary">
                    {item.total_qtde}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-5 py-8 text-center text-dark-4" colSpan={3}>
                  Sem dados para este periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [estatisticas, produtos, clientes, orcamentos, categorias] =
        await Promise.all([
          apiRequest<EstatisticasResumo>("/api/v1/estatisticas-produtos/resumo", {
            query: { limit: 8 },
          }),
          listResource<AnyRow>("/api/v1/produtos", { limit: 1 }),
          listResource<AnyRow>("/api/v1/clientes", { limit: 1 }),
          listResource<AnyRow>("/api/v1/orcamentos", { limit: 1 }),
          listResource<AnyRow>("/api/v1/categorias", { limit: 1 }),
        ]);

      setState({ estatisticas, produtos, clientes, orcamentos, categorias });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const chartData = state.estatisticas?.mais_orcados || [];
  const chartOptions = useMemo<ApexOptions>(
    () => ({
      chart: { toolbar: { show: false }, fontFamily: "inherit" },
      colors: ["#b91c1c"],
      dataLabels: { enabled: false },
      grid: { strokeDashArray: 5 },
      plotOptions: { bar: { borderRadius: 6, columnWidth: "45%" } },
      xaxis: {
        categories: chartData.map((item) => item.codigo || `#${item.id_produto}`),
      },
    }),
    [chartData],
  );

  return (
    <div className="space-y-6">

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          detail="Catalogo cadastrado"
          label="Produtos"
          value={loading ? "..." : state.produtos?.total || 0}
        />
        <StatCard
          detail="Base comercial"
          label="Clientes"
          value={loading ? "..." : state.clientes?.total || 0}
        />
        <StatCard
          detail="Propostas registradas"
          label="Orçamentos"
          value={loading ? "..." : state.orcamentos?.total || 0}
        />
        <StatCard
          detail="Organizacao do catalogo"
          label="Categorias"
          value={loading ? "..." : state.categorias?.total || 0}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-dark dark:text-white">
              Produtos mais orcados
            </h2>
            <p className="text-sm text-dark-4 dark:text-dark-6">
              Ranking historico vindo de estatisticas_produtos.
            </p>
          </div>
          <div className="h-[330px]">
            {chartData.length ? (
              <Chart
                height={330}
                options={chartOptions}
                series={[
                  {
                    name: "Qtde",
                    data: chartData.map((item) => item.total_qtde),
                  },
                ]}
                type="bar"
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-stroke text-sm text-dark-4 dark:border-dark-3">
                Sem estatisticas disponiveis.
              </div>
            )}
          </div>
        </div>

        <RankingTable
          data={state.estatisticas?.melhores_do_dia || []}
          title="Melhores do dia"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RankingTable
          data={state.estatisticas?.melhores_do_mes || []}
          title="Melhores do mes"
        />
        <RankingTable
          data={state.estatisticas?.melhores_do_ano || []}
          title="Melhores do ano"
        />
      </div>
    </div>
  );
}
