import { query } from '@database/connection';
import type { ProdutoRanking } from '@/types/estatistica-produto';

export class EstatisticaProdutoModel {
  static async ranking(
    empresaId: number,
    limit: number = 100,
    startDate?: string,
    endDate?: string
  ): Promise<ProdutoRanking[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    let where = 'WHERE p.id_empresa = ?';
    const values: any[] = [empresaId];

    if (startDate) {
      where += ' AND ep.data >= ?';
      values.push(startDate);
    }

    if (endDate) {
      where += ' AND ep.data < ?';
      values.push(endDate);
    }

    const sql = `
      SELECT
        ep.id_produto,
        p.codigo,
        p.produto,
        SUM(ep.qtde) as total_qtde,
        COUNT(*) as total_registros
      FROM estatisticas_produtos ep
      INNER JOIN produtos p
        ON p.id_produto = ep.id_produto
       AND p.id_empresa = ?
      ${where.replace('WHERE p.id_empresa = ?', 'WHERE 1 = 1')}
      GROUP BY ep.id_produto, p.codigo, p.produto
      ORDER BY total_qtde DESC, total_registros DESC, p.produto ASC
      LIMIT ?
    `;

    const result = await query(sql, [empresaId, ...values.slice(1), safeLimit]);
    return result as ProdutoRanking[];
  }
}
