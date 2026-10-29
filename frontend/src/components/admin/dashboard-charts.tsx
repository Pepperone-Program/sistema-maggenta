"use client";

import { apiRequest } from "@/lib/api";
import { FeedbackToast } from "@/components/ui/toast";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
type Category = { id_categoria: number; categoria: string; total: number };
type Summary = {
  categorias_orcamentos: Category[];
  categorias_produtos: Category[];
  orcamentos_por_dia: { dia: string; total: number }[];
};
const palette = ["#be185d", "#7c3aed", "#0284c7", "#0d9488", "#ca8a04", "#ea580c", "#64748b", "#9333ea"];

export function DashboardCharts() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiRequest<Summary>("/api/v1/estatisticas-produtos/dashboard")
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Falha ao carregar gráficos"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const base: ApexOptions = {
    chart: { toolbar: { show: false }, fontFamily: "inherit", background: "transparent", animations: { enabled: false } },
    theme: { mode: resolvedTheme === "dark" ? "dark" : "light" },
    colors: palette,
    dataLabels: { enabled: false },
    grid: { strokeDashArray: 4, borderColor: resolvedTheme === "dark" ? "#374151" : "#e5e7eb" },
    tooltip: { y: { formatter: value => value.toLocaleString("pt-BR") } },
    noData: { text: "Sem dados disponíveis." },
  };
  const configs = [
    { title: "Categorias com mais orçamentos", detail: "Top 8 · Histórico completo. Cada orçamento conta uma vez por categoria; pode aparecer em várias categorias. As fatias comparam apenas as categorias exibidas.", type: "pie" as const,
      rows: data?.categorias_orcamentos || [], options: { ...base, labels: data?.categorias_orcamentos.map(row => row.categoria), legend: { position: "bottom" as const }, stroke: { width: 2 }, dataLabels: { enabled: true } },
      series: data?.categorias_orcamentos.map(row => row.total) || [] },
    { title: "Categorias com mais produtos", detail: "Top 8 · Catálogo atual, incluindo vínculos por subcategorias. Cada produto conta uma vez por categoria.", type: "bar" as const,
      rows: data?.categorias_produtos || [], options: { ...base, colors: [palette[1]], plotOptions: { bar: { horizontal: true, borderRadius: 4 } }, xaxis: { categories: data?.categorias_produtos.map(row => row.categoria), decimalsInFloat: 0 }, yaxis: { labels: { maxWidth: 160 } } },
      series: [{ name: "Produtos", data: data?.categorias_produtos.map(row => row.total) || [] }] },
    { title: "Orçamentos por dia", detail: "Últimos 30 dias, incluindo hoje · Data de cadastro do orçamento.", type: "area" as const,
      rows: data?.orcamentos_por_dia || [], options: { ...base, colors: [palette[0]], stroke: { curve: "straight" as const, width: 3 }, fill: { type: "solid", opacity: 0.12 }, xaxis: { categories: data?.orcamentos_por_dia.map(row => row.dia.slice(5).split("-").reverse().join("/")), tickAmount: 9 }, yaxis: { min: 0, forceNiceScale: true, decimalsInFloat: 0 } },
      series: [{ name: "Orçamentos", data: data?.orcamentos_por_dia.map(row => row.total) || [] }] },
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <FeedbackToast message={error} />
      {configs.map((config, index) => (
        <section key={config.title} aria-label={config.title} aria-busy={loading} className={`min-w-0 rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark ${index === 2 ? "xl:col-span-2" : ""}`}>
          <h2 className="text-lg font-bold text-dark dark:text-white">{config.title}</h2>
          <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">{config.detail}</p>
          {loading ? <div className="flex h-[280px] items-center justify-center text-sm text-dark-4">Carregando gráfico...</div>
            : error ? <div className="flex h-[280px] items-center justify-center"><button type="button" onClick={() => setAttempt(value => value + 1)} className="rounded-md border border-stroke px-4 py-2 text-sm font-semibold text-primary">Tentar carregar novamente</button></div>
            : config.rows.length > 0 ? <>
              <Chart type={config.type} height={280} options={config.options} series={config.series} />
              <details className="mt-2 text-sm text-dark-4 dark:text-dark-6">
                <summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Ver dados do gráfico</summary>
                <table className="mt-3 w-full text-left"><caption className="sr-only">{config.title}</caption><thead><tr><th>{index === 2 ? "Dia" : "Categoria"}</th><th className="text-right">Total</th></tr></thead><tbody>
                  {config.rows.map(row => <tr key={"dia" in row ? row.dia : row.id_categoria}><td className="py-1">{"dia" in row ? row.dia.split("-").reverse().join("/") : row.categoria}</td><td className="text-right">{row.total.toLocaleString("pt-BR")}</td></tr>)}
                </tbody></table>
              </details>
            </> : <div className="flex h-[280px] items-center justify-center text-sm text-dark-4">Nenhum registro neste período.</div>}
        </section>
      ))}
    </div>
  );
}
