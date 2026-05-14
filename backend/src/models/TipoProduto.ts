import { query } from '@database/connection';

const normalizeLimit = (limit: number): number => Math.min(Math.max(limit, 1), 500);
const normalizePage = (page: number): number => Math.max(page, 1);

export class TipoProdutoModel {
  static async findAll(
    empresaId: number,
    page: number = 1,
    limit: number = 100,
    filters: { search?: string; habilitado?: string } = {}
  ) {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    let where = 'WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (filters.search) {
      where += ' AND (tipo_produto LIKE ? OR descricao LIKE ?)';
      const searchPattern = `%${filters.search}%`;
      values.push(searchPattern, searchPattern);
    }

    if (filters.habilitado === 'S' || filters.habilitado === 'N') {
      where += ' AND habilitado = ?';
      values.push(filters.habilitado);
    }

    const countRows = (await query(
      `SELECT COUNT(*) as total FROM tipos_produtos ${where}`,
      values
    )) as Array<{ total: number }>;

    const items = await query(
      `
        SELECT id_empresa, id_tipo_produto, tipo_produto, descricao, habilitado
        FROM tipos_produtos
        ${where}
        ORDER BY tipo_produto ASC, id_tipo_produto ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );

    return {
      items: items as any[],
      total: Number(countRows[0]?.total || 0),
      page: safePage,
      limit: safeLimit,
    };
  }

  static async findById(empresaId: number, tipoProdutoId: number) {
    const result = await query(
      `
        SELECT id_empresa, id_tipo_produto, tipo_produto, descricao, habilitado
        FROM tipos_produtos
        WHERE id_empresa = ? AND id_tipo_produto = ?
        LIMIT 1
      `,
      [empresaId, tipoProdutoId]
    );

    return (result as any[])[0] || null;
  }

  static async findCatalogProducts(
    empresaId: number,
    tipoProdutoId: number,
    filters: {
      page: number;
      limit: number;
      subcategorias?: number[];
      publicosAlvos?: number[];
      datasPromocionais?: number[];
      quantidadeMinimaMin?: number;
      quantidadeMinimaMax?: number;
    }
  ) {
    const safePage = normalizePage(filters.page);
    const safeLimit = normalizeLimit(filters.limit);
    const where: string[] = [
      'p.id_empresa = ?',
      'p.id_tipo_produto = ?',
      "p.habilitado = 'S'",
      "p.site = 'S'",
    ];
    const values: any[] = [empresaId, tipoProdutoId];

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
        SELECT COUNT(*) as total
        FROM produtos p
        WHERE ${whereSql}
      `,
      values
    )) as Array<{ total: number }>;

    const productRows = (await query(
      `
        SELECT p.*, NULL as imagem_url
        FROM produtos p
        WHERE ${whereSql}
        ORDER BY p.produto ASC, p.id_produto ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    )) as any[];

    const productIds = productRows.map((item) => Number(item.id_produto)).filter(Boolean);

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
                WHERE ip.id_produto IN (${productIds.map(() => '?').join(',')})
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
              WHERE asp.id_empresa = ? AND asp.id_produto IN (${productIds.map(() => '?').join(',')})
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
              WHERE app.id_produto IN (${productIds.map(() => '?').join(',')})
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
              WHERE adp.id_produto IN (${productIds.map(() => '?').join(',')})
              ORDER BY dp.ordem ASC, dp.data_promocional ASC
            `,
            productIds
          )
        : [],
    ]);

    const groupByProduct = (rows: any[], mapper: (row: any) => any) => {
      const grouped = new Map<number, any[]>();
      for (const row of rows) {
        const idProduto = Number(row.id_produto);
        const list = grouped.get(idProduto) || [];
        list.push(mapper(row));
        grouped.set(idProduto, list);
      }
      return grouped;
    };

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

  static async findCatalogFacets(empresaId: number, tipoProdutoId: number) {
    const baseValues = [empresaId, tipoProdutoId];
    const [subcategorias, publicosAlvos, datasPromocionais, quantidadeRows] = await Promise.all([
      query(
        `
          SELECT s.id_subcategoria, s.subcategoria, COUNT(DISTINCT p.id_produto) as total
          FROM produtos p
          INNER JOIN aux_subcategorias_produtos asp
            ON asp.id_empresa = p.id_empresa AND asp.id_produto = p.id_produto
          INNER JOIN subcategorias s
            ON s.id_empresa = asp.id_empresa AND s.id_subcategoria = asp.id_subcategoria
          WHERE p.id_empresa = ? AND p.id_tipo_produto = ?
            AND p.habilitado = 'S' AND p.site = 'S' AND s.habilitado = 'S'
          GROUP BY s.id_subcategoria, s.subcategoria, s.ordem
          ORDER BY s.ordem ASC, s.subcategoria ASC
        `,
        baseValues
      ),
      query(
        `
          SELECT pa.id_publico_alvo, pa.publico_alvo, COUNT(DISTINCT p.id_produto) as total
          FROM produtos p
          INNER JOIN aux_publicos_alvos_produtos app
            ON app.id_produto = p.id_produto
          INNER JOIN publicos_alvos pa
            ON pa.id_publico_alvo = app.id_publico_alvo
          WHERE p.id_empresa = ? AND p.id_tipo_produto = ?
            AND p.habilitado = 'S' AND p.site = 'S' AND pa.habilitado = 'S'
          GROUP BY pa.id_publico_alvo, pa.publico_alvo, pa.ordem
          ORDER BY pa.ordem ASC, pa.publico_alvo ASC
        `,
        baseValues
      ),
      query(
        `
          SELECT dp.id_data_promocional, dp.data_promocional, dp.data, COUNT(DISTINCT p.id_produto) as total
          FROM produtos p
          INNER JOIN aux_datas_promocionais_produtos adp
            ON adp.id_produto = p.id_produto
          INNER JOIN datas_promocionais dp
            ON dp.id_data_promocional = adp.id_data_promocional
          WHERE p.id_empresa = ? AND p.id_tipo_produto = ?
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
          FROM produtos p
          WHERE p.id_empresa = ? AND p.id_tipo_produto = ?
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
