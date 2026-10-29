import { query } from '@database/connection';

type CategoryCount = { id_categoria: number; categoria: string; total: number };
type DayCount = { dia: string; total: number };

// UNION includes subcategory-only products without duplicating direct links.
const membership = `
  SELECT id_empresa, id_categoria, id_produto FROM aux_categorias_produtos WHERE id_empresa = ?
  UNION
  SELECT s.id_empresa, s.id_categoria, a.id_produto
  FROM aux_subcategorias_produtos a
  INNER JOIN subcategorias s ON s.id_empresa = a.id_empresa AND s.id_subcategoria = a.id_subcategoria
  WHERE s.id_empresa = ?`;

export function dashboardDays(today: string, counts: DayCount[]) {
  const byDay = new Map(counts.map(row => [row.dia, Number(row.total)]));
  return Array.from({ length: 30 }, (_, index) => {
    const day = new Date(`${today}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() - 29 + index);
    const dia = day.toISOString().slice(0, 10);
    return { dia, total: byDay.get(dia) || 0 };
  });
}

export class DashboardModel {
  static async summary(empresaId: number) {
    // Match the calendar used by the stored data_orcamento values.
    const dates = await query("SELECT DATE_FORMAT(CURRENT_DATE(), '%Y-%m-%d') AS hoje") as Array<{ hoje: string }>;
    const days = dashboardDays(dates[0].hoje, []);
    const end = new Date(`${dates[0].hoje}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const [quotes, products, daily] = await Promise.all([
      query(`SELECT c.id_categoria, c.categoria, COUNT(DISTINCT o.id_orcamento) AS total
        FROM orcamentos o
        INNER JOIN orcamentos_itens i ON i.id_orcamento = o.id_orcamento
        INNER JOIN produtos p ON p.id_produto = i.id_produto AND p.id_empresa = o.id_empresa
        INNER JOIN (${membership}) m ON m.id_empresa = p.id_empresa AND m.id_produto = p.id_produto
        INNER JOIN categorias c ON c.id_empresa = m.id_empresa AND c.id_categoria = m.id_categoria
        WHERE o.id_empresa = ?
        GROUP BY c.id_categoria, c.categoria ORDER BY total DESC, c.categoria ASC, c.id_categoria ASC LIMIT 8`, [empresaId, empresaId, empresaId]),
      query(`SELECT c.id_categoria, c.categoria, COUNT(DISTINCT p.id_produto) AS total
        FROM categorias c
        INNER JOIN (${membership}) m ON m.id_empresa = c.id_empresa AND m.id_categoria = c.id_categoria
        INNER JOIN produtos p ON p.id_empresa = m.id_empresa AND p.id_produto = m.id_produto
        WHERE c.id_empresa = ?
        GROUP BY c.id_categoria, c.categoria ORDER BY total DESC, c.categoria ASC, c.id_categoria ASC LIMIT 8`, [empresaId, empresaId, empresaId]),
      query(`SELECT DATE_FORMAT(data_orcamento, '%Y-%m-%d') AS dia, COUNT(*) AS total
        FROM orcamentos WHERE id_empresa = ? AND data_orcamento >= ? AND data_orcamento < ?
        GROUP BY DATE_FORMAT(data_orcamento, '%Y-%m-%d') ORDER BY dia`, [empresaId, days[0].dia, end.toISOString().slice(0, 10)]),
    ]);
    const normalize = (rows: unknown) => (rows as CategoryCount[]).map(row => ({ ...row, total: Number(row.total) }));
    return { categorias_orcamentos: normalize(quotes), categorias_produtos: normalize(products), orcamentos_por_dia: dashboardDays(dates[0].hoje, daily as DayCount[]) };
  }
}
