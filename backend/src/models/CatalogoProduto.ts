import { query } from '@database/connection';

const normalizeLimit = (limit: number): number => Math.min(Math.max(limit, 1), 500);
const normalizePage = (page: number): number => Math.max(page, 1);

type CatalogRelation = {
  table: 'aux_publicos_alvos_produtos' | 'aux_datas_promocionais_produtos';
  column: 'id_publico_alvo' | 'id_data_promocional';
};

type CatalogFilters = {
  page: number;
  limit: number;
  subcategorias?: number[];
  publicosAlvos?: number[];
  datasPromocionais?: number[];
  quantidadeMinimaMin?: number;
  quantidadeMinimaMax?: number;
};

const groupByProduct = (rows: any[], mapper: (row: any) => any): Map<number, any[]> => {
  const grouped = new Map<number, any[]>();
  for (const row of rows) {
    const idProduto = Number(row.id_produto);
    const list = grouped.get(idProduto) || [];
    list.push(mapper(row));
    grouped.set(idProduto, list);
  }
  return grouped;
};

export class CatalogoProdutoModel {
  static async findRelatedProducts(
    empresaId: number,
    relation: CatalogRelation,
    relationId: number,
    filters: CatalogFilters
  ) {
    const safePage = normalizePage(filters.page);
    const safeLimit = normalizeLimit(filters.limit);
    const where: string[] = [
      'p.id_empresa = ?',
      `rel.${relation.column} = ?`,
      "p.habilitado = 'S'",
      "p.site = 'S'",
    ];
    const values: any[] = [empresaId, relationId];

    if (filters.quantidadeMinimaMin !== undefined) {
      where.push("CAST(COALESCE(NULLIF(p.quantidade_minima, ''), 0) AS UNSIGNED) >= ?");
      values.push(filters.quantidadeMinimaMin);
    }

    if (filters.quantidadeMinimaMax !== undefined) {
      where.push("CAST(COALESCE(NULLIF(p.quantidade_minima, ''), 0) AS UNSIGNED) <= ?");
      values.push(filters.quantidadeMinimaMax);
    }

    if (filters.subcategorias?.length) {
      where.push(`
        EXISTS (
          SELECT 1
          FROM aux_subcategorias_produtos asp_filter
          WHERE asp_filter.id_empresa = p.id_empresa
            AND asp_filter.id_produto = p.id_produto
            AND asp_filter.id_subcategoria IN (${filters.subcategorias.map(() => '?').join(',')})
        )
      `);
      values.push(...filters.subcategorias);
    }

    if (filters.publicosAlvos?.length) {
      where.push(`
        EXISTS (
          SELECT 1
          FROM aux_publicos_alvos_produtos app_filter
          WHERE app_filter.id_produto = p.id_produto
            AND app_filter.id_publico_alvo IN (${filters.publicosAlvos.map(() => '?').join(',')})
        )
      `);
      values.push(...filters.publicosAlvos);
    }

    if (filters.datasPromocionais?.length) {
      where.push(`
        EXISTS (
          SELECT 1
          FROM aux_datas_promocionais_produtos adp_filter
          WHERE adp_filter.id_produto = p.id_produto
            AND adp_filter.id_data_promocional IN (${filters.datasPromocionais.map(() => '?').join(',')})
        )
      `);
      values.push(...filters.datasPromocionais);
    }

    const whereSql = where.join(' AND ');
    const countRows = (await query(
      `
        SELECT COUNT(DISTINCT p.id_produto) as total
        FROM ${relation.table} rel
        INNER JOIN produtos p
          ON p.id_produto = rel.id_produto
        WHERE ${whereSql}
      `,
      values
    )) as Array<{ total: number }>;

    const productRows = (await query(
      `
        SELECT p.*, NULL as imagem_url
        FROM ${relation.table} rel
        INNER JOIN produtos p
          ON p.id_produto = rel.id_produto
        WHERE ${whereSql}
        ORDER BY p.produto ASC, p.id_produto ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    )) as any[];

    const productIds = productRows.map((item) => Number(item.id_produto)).filter(Boolean);
    const placeholders = productIds.map(() => '?').join(',');

    const [imagensRows, subcategoriasRows, publicosRows, datasRows] = await Promise.all([
      productIds.length
        ? query(
            `
              SELECT id_imagem, id_produto, url_imagem, ordem_imagem, created_at
              FROM (
                SELECT
                  ip.*,
                  ROW_NUMBER() OVER (
                    PARTITION BY ip.id_produto
                    ORDER BY ip.ordem_imagem ASC, ip.id_imagem ASC
                  ) as rn
                FROM imagens_produtos ip
                WHERE ip.id_produto IN (${placeholders})
              ) ranked
              WHERE rn <= 3
              ORDER BY id_produto ASC, ordem_imagem ASC, id_imagem ASC
            `,
            productIds
          )
        : [],
      productIds.length
        ? query(
            `
              SELECT asp.id_produto, s.id_subcategoria, s.subcategoria
              FROM aux_subcategorias_produtos asp
              INNER JOIN subcategorias s
                ON s.id_empresa = asp.id_empresa AND s.id_subcategoria = asp.id_subcategoria
              WHERE asp.id_empresa = ? AND asp.id_produto IN (${placeholders})
              ORDER BY s.ordem ASC, s.subcategoria ASC
            `,
            [empresaId, ...productIds]
          )
        : [],
      productIds.length
        ? query(
            `
              SELECT app.id_produto, pa.id_publico_alvo, pa.publico_alvo
              FROM aux_publicos_alvos_produtos app
              INNER JOIN publicos_alvos pa
                ON pa.id_publico_alvo = app.id_publico_alvo
              WHERE app.id_produto IN (${placeholders})
              ORDER BY pa.ordem ASC, pa.publico_alvo ASC
            `,
            productIds
          )
        : [],
      productIds.length
        ? query(
            `
              SELECT adp.id_produto, dp.id_data_promocional, dp.data_promocional, dp.data
              FROM aux_datas_promocionais_produtos adp
              INNER JOIN datas_promocionais dp
                ON dp.id_data_promocional = adp.id_data_promocional
              WHERE adp.id_produto IN (${placeholders})
              ORDER BY dp.ordem ASC, dp.data_promocional ASC
            `,
            productIds
          )
        : [],
    ]);

    const imagensByProduct = groupByProduct(imagensRows as any[], (row) => ({
      id_imagem: row.id_imagem,
      url_imagem: row.url_imagem,
      ordem_imagem: row.ordem_imagem,
      created_at: row.created_at,
    }));
    const subByProduct = groupByProduct(subcategoriasRows as any[], (row) => ({
      id_subcategoria: row.id_subcategoria,
      subcategoria: row.subcategoria,
    }));
    const publicosByProduct = groupByProduct(publicosRows as any[], (row) => ({
      id_publico_alvo: row.id_publico_alvo,
      publico_alvo: row.publico_alvo,
    }));
    const datasByProduct = groupByProduct(datasRows as any[], (row) => ({
      id_data_promocional: row.id_data_promocional,
      data_promocional: row.data_promocional,
      data: row.data,
    }));

    return {
      items: productRows.map((item) => ({
        ...item,
        imagens: imagensByProduct.get(Number(item.id_produto)) || [],
        imagem_url: imagensByProduct.get(Number(item.id_produto))?.[0]?.url_imagem || null,
        subcategorias: subByProduct.get(Number(item.id_produto)) || [],
        publicos_alvos: publicosByProduct.get(Number(item.id_produto)) || [],
        datas_promocionais: datasByProduct.get(Number(item.id_produto)) || [],
      })),
      total: Number(countRows[0]?.total || 0),
      page: safePage,
      limit: safeLimit,
    };
  }

  static async findRelatedFacets(
    empresaId: number,
    relation: CatalogRelation,
    relationId: number
  ) {
    const baseValues = [empresaId, relationId];
    const baseFrom = `
      FROM ${relation.table} rel
      INNER JOIN produtos p
        ON p.id_produto = rel.id_produto
    `;

    const [subcategorias, publicosAlvos, datasPromocionais, quantidadeRows] = await Promise.all([
      query(
        `
          SELECT s.id_subcategoria, s.subcategoria, COUNT(DISTINCT p.id_produto) as total
          ${baseFrom}
          INNER JOIN aux_subcategorias_produtos asp
            ON asp.id_empresa = p.id_empresa AND asp.id_produto = p.id_produto
          INNER JOIN subcategorias s
            ON s.id_empresa = asp.id_empresa AND s.id_subcategoria = asp.id_subcategoria
          WHERE p.id_empresa = ? AND rel.${relation.column} = ?
            AND p.habilitado = 'S' AND p.site = 'S' AND s.habilitado = 'S'
          GROUP BY s.id_subcategoria, s.subcategoria, s.ordem
          ORDER BY s.ordem ASC, s.subcategoria ASC
        `,
        baseValues
      ),
      query(
        `
          SELECT pa.id_publico_alvo, pa.publico_alvo, COUNT(DISTINCT p.id_produto) as total
          ${baseFrom}
          INNER JOIN aux_publicos_alvos_produtos app
            ON app.id_produto = p.id_produto
          INNER JOIN publicos_alvos pa
            ON pa.id_publico_alvo = app.id_publico_alvo
          WHERE p.id_empresa = ? AND rel.${relation.column} = ?
            AND p.habilitado = 'S' AND p.site = 'S' AND pa.habilitado = 'S'
          GROUP BY pa.id_publico_alvo, pa.publico_alvo, pa.ordem
          ORDER BY pa.ordem ASC, pa.publico_alvo ASC
        `,
        baseValues
      ),
      query(
        `
          SELECT dp.id_data_promocional, dp.data_promocional, dp.data, COUNT(DISTINCT p.id_produto) as total
          ${baseFrom}
          INNER JOIN aux_datas_promocionais_produtos adp
            ON adp.id_produto = p.id_produto
          INNER JOIN datas_promocionais dp
            ON dp.id_data_promocional = adp.id_data_promocional
          WHERE p.id_empresa = ? AND rel.${relation.column} = ?
            AND p.habilitado = 'S' AND p.site = 'S' AND dp.habilitado = 'S'
          GROUP BY dp.id_data_promocional, dp.data_promocional, dp.data, dp.ordem
          ORDER BY dp.ordem ASC, dp.data_promocional ASC
        `,
        baseValues
      ),
      query(
        `
          SELECT
            MIN(CAST(COALESCE(NULLIF(p.quantidade_minima, ''), 0) AS UNSIGNED)) as min,
            MAX(CAST(COALESCE(NULLIF(p.quantidade_minima, ''), 0) AS UNSIGNED)) as max
          ${baseFrom}
          WHERE p.id_empresa = ? AND rel.${relation.column} = ?
            AND p.habilitado = 'S' AND p.site = 'S'
        `,
        baseValues
      ),
    ]);

    return {
      subcategorias,
      publicos_alvos: publicosAlvos,
      datas_promocionais: datasPromocionais,
      quantidade_minima: (quantidadeRows as any[])[0] || { min: 0, max: 0 },
    };
  }
}
