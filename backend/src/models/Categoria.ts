import { query } from '@database/connection';
import type {
  Categoria,
  CategoriaProduto,
  CreateCategoriaDTO,
  CreateSubcategoriaDTO,
  Subcategoria,
  SubcategoriaProduto,
  UpdateCategoriaDTO,
  UpdateSubcategoriaDTO,
} from '@/types/categoria';

const normalizeLimit = (limit: number): number => Math.min(Math.max(limit, 1), 500);
const normalizePage = (page: number): number => Math.max(page, 1);

export class CategoriaModel {
  static async findSearchCandidates(
    empresaId: number,
    term: string,
    limit: number = 20
  ): Promise<Categoria[]> {
    const searchPattern = `%${term}%`;
    const result = await query(
      `
        SELECT id_empresa, id_categoria, categoria, descricao, icon, habilitado, url_capa
        FROM categorias
        WHERE id_empresa = ?
          AND habilitado = 'S'
          AND categoria LIKE ?
        ORDER BY
          CASE
            WHEN categoria LIKE ? THEN 0
            WHEN categoria LIKE ? THEN 1
            ELSE 2
          END,
          categoria ASC,
          id_categoria ASC
        LIMIT ?
      `,
      [empresaId, searchPattern, `${term}%`, `% ${term}%`, limit]
    );

    return result as Categoria[];
  }

  static async create(empresaId: number, data: CreateCategoriaDTO): Promise<number> {
    const columns = ['id_empresa', 'categoria', 'descricao', 'icon', 'habilitado', 'url_capa'];
    const placeholders = ['?', '?', '?', '?', '?', '?'];
    const values: any[] = [
      empresaId,
      data.categoria,
      data.descricao || null,
      data.icon || null,
      data.habilitado || 'S',
      data.url_capa || null,
    ];

    if (data.id_categoria !== undefined) {
      columns.splice(1, 0, 'id_categoria');
      placeholders.splice(1, 0, '?');
      values.splice(1, 0, data.id_categoria);
    }

    const sql = `
      INSERT INTO categorias (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;

    const result = await query(sql, values);
    return data.id_categoria ?? (result as any).insertId;
  }

  static async findById(empresaId: number, categoriaId: number): Promise<Categoria | null> {
    const sql = `
      SELECT id_empresa, id_categoria, categoria, descricao, icon, habilitado
           , url_capa
      FROM categorias
      WHERE id_empresa = ? AND id_categoria = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, categoriaId]);
    return (result as Categoria[])[0] || null;
  }

  static async findByName(empresaId: number, categoria: string): Promise<Categoria | null> {
    const sql = `
      SELECT id_empresa, id_categoria, categoria, descricao, icon, habilitado
           , url_capa
      FROM categorias
      WHERE id_empresa = ? AND LOWER(categoria) = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, categoria.trim().toLowerCase()]);
    return (result as Categoria[])[0] || null;
  }

  static async findAll(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
    search?: string,
    habilitado?: string
  ): Promise<{ items: Categoria[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    let where = 'WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (search) {
      where += ' AND (categoria LIKE ? OR descricao LIKE ?)';
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern);
    }

    if (habilitado) {
      where += ' AND habilitado = ?';
      values.push(habilitado);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM categorias ${where}`,
      values
    );
    const total = (countResult as any[])[0].total;

    const sql = `
      SELECT id_empresa, id_categoria, categoria, descricao, icon, habilitado, url_capa
      FROM categorias
      ${where}
      ORDER BY categoria ASC
      LIMIT ? OFFSET ?
    `;
    const items = await query(sql, [...values, safeLimit, (safePage - 1) * safeLimit]);
    return { items: items as Categoria[], total };
  }

  static async update(
    empresaId: number,
    categoriaId: number,
    data: UpdateCategoriaDTO
  ): Promise<boolean> {
    const allowedColumns = ['categoria', 'descricao', 'icon', 'habilitado', 'url_capa'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedColumns.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value ?? null);
      }
    }

    if (updates.length === 0) return true;

    const sql = `
      UPDATE categorias
      SET ${updates.join(', ')}
      WHERE id_empresa = ? AND id_categoria = ?
    `;
    const result = await query(sql, [...values, empresaId, categoriaId]);
    return (result as any).affectedRows > 0;
  }

  static async delete(empresaId: number, categoriaId: number): Promise<boolean> {
    const sql = 'DELETE FROM categorias WHERE id_empresa = ? AND id_categoria = ?';
    const result = await query(sql, [empresaId, categoriaId]);
    return (result as any).affectedRows > 0;
  }

  static async hasSubcategorias(empresaId: number, categoriaId: number): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM subcategorias
      WHERE id_empresa = ? AND id_categoria = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, categoriaId]);
    return (result as any[]).length > 0;
  }

  static async hasProdutos(empresaId: number, categoriaId: number): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM aux_categorias_produtos
      WHERE id_empresa = ? AND id_categoria = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, categoriaId]);
    return (result as any[]).length > 0;
  }

  static async produtoExists(empresaId: number, produtoId: number): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM produtos
      WHERE id_empresa = ? AND id_produto = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, produtoId]);
    return (result as any[]).length > 0;
  }

  static async findProdutoLink(
    empresaId: number,
    categoriaId: number,
    produtoId: number
  ): Promise<CategoriaProduto | null> {
    const sql = `
      SELECT id_empresa, id_categoria, id_produto
      FROM aux_categorias_produtos
      WHERE id_empresa = ? AND id_categoria = ? AND id_produto = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, categoriaId, produtoId]);
    return (result as CategoriaProduto[])[0] || null;
  }

  static async addProduto(
    empresaId: number,
    categoriaId: number,
    produtoId: number
  ): Promise<CategoriaProduto> {
    const sql = `
      INSERT INTO aux_categorias_produtos (id_empresa, id_categoria, id_produto)
      VALUES (?, ?, ?)
    `;
    await query(sql, [empresaId, categoriaId, produtoId]);
    return { id_empresa: empresaId, id_categoria: categoriaId, id_produto: produtoId };
  }

  static async removeProduto(
    empresaId: number,
    categoriaId: number,
    produtoId: number
  ): Promise<boolean> {
    const sql = `
      DELETE FROM aux_categorias_produtos
      WHERE id_empresa = ? AND id_categoria = ? AND id_produto = ?
    `;
    const result = await query(sql, [empresaId, categoriaId, produtoId]);
    return (result as any).affectedRows > 0;
  }

  static async findProdutos(
    empresaId: number,
    categoriaId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: CategoriaProduto[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    const values = [empresaId, categoriaId];
    const countResult = await query(
      `
        SELECT COUNT(*) as total
        FROM aux_categorias_produtos
        WHERE id_empresa = ? AND id_categoria = ?
      `,
      values
    );
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT id_empresa, id_categoria, id_produto
        FROM aux_categorias_produtos
        WHERE id_empresa = ? AND id_categoria = ?
        ORDER BY id_produto ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );
    return { items: items as CategoriaProduto[], total };
  }

  static async findCatalogProducts(
    empresaId: number,
    categoriaId: number,
    filters: {
      page: number;
      limit: number;
      subcategorias?: number[];
      publicosAlvos?: number[];
      quantidadeMinimaMin?: number;
      quantidadeMinimaMax?: number;
    }
  ) {
    const safePage = normalizePage(filters.page);
    const safeLimit = normalizeLimit(filters.limit);
    const where: string[] = [
      'p.id_empresa = ?',
      'acp.id_empresa = ?',
      'acp.id_categoria = ?',
      "p.habilitado = 'S'",
      "p.site = 'S'",
    ];
    const values: any[] = [empresaId, empresaId, categoriaId];

    if (filters.quantidadeMinimaMin !== undefined) {
      where.push('CAST(COALESCE(NULLIF(p.quantidade_minima, \'\'), 0) AS UNSIGNED) >= ?');
      values.push(filters.quantidadeMinimaMin);
    }

    if (filters.quantidadeMinimaMax !== undefined) {
      where.push('CAST(COALESCE(NULLIF(p.quantidade_minima, \'\'), 0) AS UNSIGNED) <= ?');
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

    const whereSql = where.join(' AND ');
    const countRows = (await query(
      `
        SELECT COUNT(DISTINCT p.id_produto) as total
        FROM aux_categorias_produtos acp
        INNER JOIN produtos p
          ON p.id_empresa = acp.id_empresa AND p.id_produto = acp.id_produto
        WHERE ${whereSql}
      `,
      values
    )) as Array<{ total: number }>;

    const productRows = (await query(
      `
        SELECT
          p.*,
          NULL as imagem_url
        FROM aux_categorias_produtos acp
        INNER JOIN produtos p
          ON p.id_empresa = acp.id_empresa AND p.id_produto = acp.id_produto
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

    const imagensByProduct = new Map<number, any[]>();
    for (const row of imagensRows as any[]) {
      const list = imagensByProduct.get(Number(row.id_produto)) || [];
      list.push({
        id_imagem: row.id_imagem,
        url_imagem: row.url_imagem,
        ordem_imagem: row.ordem_imagem,
        created_at: row.created_at,
      });
      imagensByProduct.set(Number(row.id_produto), list);
    }

    const subByProduct = new Map<number, any[]>();
    for (const row of subcategoriasRows as any[]) {
      const list = subByProduct.get(Number(row.id_produto)) || [];
      list.push({ id_subcategoria: row.id_subcategoria, subcategoria: row.subcategoria });
      subByProduct.set(Number(row.id_produto), list);
    }

    const publicosByProduct = new Map<number, any[]>();
    for (const row of publicosRows as any[]) {
      const list = publicosByProduct.get(Number(row.id_produto)) || [];
      list.push({ id_publico_alvo: row.id_publico_alvo, publico_alvo: row.publico_alvo });
      publicosByProduct.set(Number(row.id_produto), list);
    }

    const datasByProduct = new Map<number, any[]>();
    for (const row of datasRows as any[]) {
      const list = datasByProduct.get(Number(row.id_produto)) || [];
      list.push({
        id_data_promocional: row.id_data_promocional,
        data_promocional: row.data_promocional,
        data: row.data,
      });
      datasByProduct.set(Number(row.id_produto), list);
    }

    const products = productRows.map((item) => ({
      ...item,
      imagens: imagensByProduct.get(Number(item.id_produto)) || [],
      imagem_url: imagensByProduct.get(Number(item.id_produto))?.[0]?.url_imagem || null,
      subcategorias: subByProduct.get(Number(item.id_produto)) || [],
      publicos_alvos: publicosByProduct.get(Number(item.id_produto)) || [],
      datas_promocionais: datasByProduct.get(Number(item.id_produto)) || [],
    }));

    return { items: products, total: Number(countRows[0]?.total || 0), page: safePage, limit: safeLimit };
  }

  static async findCatalogFacets(empresaId: number, categoriaId: number) {
    const baseValues = [empresaId, empresaId, categoriaId];
    const [subcategorias, publicosAlvos, datasPromocionais, quantidadeRows] = await Promise.all([
      query(
        `
          SELECT s.id_subcategoria, s.subcategoria, COUNT(DISTINCT p.id_produto) as total
          FROM subcategorias s
          LEFT JOIN aux_subcategorias_produtos asp
            ON asp.id_empresa = s.id_empresa AND asp.id_subcategoria = s.id_subcategoria
          LEFT JOIN aux_categorias_produtos acp
            ON acp.id_empresa = asp.id_empresa AND acp.id_produto = asp.id_produto AND acp.id_categoria = ?
          LEFT JOIN produtos p
            ON p.id_empresa = asp.id_empresa AND p.id_produto = asp.id_produto AND p.habilitado = 'S' AND p.site = 'S'
          WHERE s.id_empresa = ? AND s.id_categoria = ? AND s.habilitado = 'S'
          GROUP BY s.id_subcategoria, s.subcategoria, s.ordem
          ORDER BY s.ordem ASC, s.subcategoria ASC
        `,
        [categoriaId, empresaId, categoriaId]
      ),
      query(
        `
          SELECT pa.id_publico_alvo, pa.publico_alvo, COUNT(DISTINCT p.id_produto) as total
          FROM aux_categorias_produtos acp
          INNER JOIN produtos p
            ON p.id_empresa = acp.id_empresa AND p.id_produto = acp.id_produto AND p.habilitado = 'S' AND p.site = 'S'
          INNER JOIN aux_publicos_alvos_produtos app
            ON app.id_produto = p.id_produto
          INNER JOIN publicos_alvos pa
            ON pa.id_publico_alvo = app.id_publico_alvo
          WHERE acp.id_empresa = ? AND p.id_empresa = ? AND acp.id_categoria = ? AND pa.habilitado = 'S'
          GROUP BY pa.id_publico_alvo, pa.publico_alvo, pa.ordem
          ORDER BY pa.ordem ASC, pa.publico_alvo ASC
        `,
        baseValues
      ),
      query(
        `
          SELECT dp.id_data_promocional, dp.data_promocional, dp.data, COUNT(DISTINCT p.id_produto) as total
          FROM aux_categorias_produtos acp
          INNER JOIN produtos p
            ON p.id_empresa = acp.id_empresa AND p.id_produto = acp.id_produto AND p.habilitado = 'S' AND p.site = 'S'
          INNER JOIN aux_datas_promocionais_produtos adp
            ON adp.id_produto = p.id_produto
          INNER JOIN datas_promocionais dp
            ON dp.id_data_promocional = adp.id_data_promocional
          WHERE acp.id_empresa = ? AND p.id_empresa = ? AND acp.id_categoria = ? AND dp.habilitado = 'S'
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
          FROM aux_categorias_produtos acp
          INNER JOIN produtos p
            ON p.id_empresa = acp.id_empresa AND p.id_produto = acp.id_produto
          WHERE acp.id_empresa = ? AND p.id_empresa = ? AND acp.id_categoria = ?
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

export class SubcategoriaModel {
  static async create(empresaId: number, data: CreateSubcategoriaDTO): Promise<number> {
    const columns = [
      'id_empresa',
      'id_categoria',
      'subcategoria',
      'descricao',
      'icon',
      'habilitado',
      'ordem',
    ];
    const placeholders = ['?', '?', '?', '?', '?', '?', '?'];
    const values: any[] = [
      empresaId,
      data.id_categoria,
      data.subcategoria,
      data.descricao || null,
      data.icon || null,
      data.habilitado || 'S',
      data.ordem ?? 0,
    ];

    if (data.id_subcategoria !== undefined) {
      columns.splice(2, 0, 'id_subcategoria');
      placeholders.splice(2, 0, '?');
      values.splice(2, 0, data.id_subcategoria);
    }

    const sql = `
      INSERT INTO subcategorias (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;

    const result = await query(sql, values);
    return data.id_subcategoria ?? (result as any).insertId;
  }

  static async findById(empresaId: number, subcategoriaId: number): Promise<Subcategoria | null> {
    const sql = `
      SELECT id_empresa, id_categoria, id_subcategoria, subcategoria, descricao, icon, habilitado, ordem
      FROM subcategorias
      WHERE id_empresa = ? AND id_subcategoria = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, subcategoriaId]);
    return (result as Subcategoria[])[0] || null;
  }

  static async findByName(
    empresaId: number,
    categoriaId: number,
    subcategoria: string
  ): Promise<Subcategoria | null> {
    const sql = `
      SELECT id_empresa, id_categoria, id_subcategoria, subcategoria, descricao, icon, habilitado, ordem
      FROM subcategorias
      WHERE id_empresa = ? AND id_categoria = ? AND LOWER(subcategoria) = ?
      LIMIT 1
    `;
    const result = await query(
      sql,
      [empresaId, categoriaId, subcategoria.trim().toLowerCase()]
    );
    return (result as Subcategoria[])[0] || null;
  }

  static async findAll(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
    search?: string,
    categoriaId?: number,
    habilitado?: string
  ): Promise<{ items: Subcategoria[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    let where = 'WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (categoriaId) {
      where += ' AND id_categoria = ?';
      values.push(categoriaId);
    }

    if (search) {
      where += ' AND (subcategoria LIKE ? OR descricao LIKE ?)';
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern);
    }

    if (habilitado) {
      where += ' AND habilitado = ?';
      values.push(habilitado);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM subcategorias ${where}`,
      values
    );
    const total = (countResult as any[])[0].total;

    const sql = `
      SELECT id_empresa, id_categoria, id_subcategoria, subcategoria, descricao, icon, habilitado, ordem
      FROM subcategorias
      ${where}
      ORDER BY ordem ASC, subcategoria ASC
      LIMIT ? OFFSET ?
    `;
    const items = await query(sql, [...values, safeLimit, (safePage - 1) * safeLimit]);
    return { items: items as Subcategoria[], total };
  }

  static async update(
    empresaId: number,
    subcategoriaId: number,
    data: UpdateSubcategoriaDTO
  ): Promise<boolean> {
    const allowedColumns = [
      'id_categoria',
      'subcategoria',
      'descricao',
      'icon',
      'habilitado',
      'ordem',
    ];
    const updates: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedColumns.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value ?? null);
      }
    }

    if (updates.length === 0) return true;

    const sql = `
      UPDATE subcategorias
      SET ${updates.join(', ')}
      WHERE id_empresa = ? AND id_subcategoria = ?
    `;
    const result = await query(sql, [...values, empresaId, subcategoriaId]);
    return (result as any).affectedRows > 0;
  }

  static async delete(empresaId: number, subcategoriaId: number): Promise<boolean> {
    const sql = 'DELETE FROM subcategorias WHERE id_empresa = ? AND id_subcategoria = ?';
    const result = await query(sql, [empresaId, subcategoriaId]);
    return (result as any).affectedRows > 0;
  }

  static async hasProdutos(empresaId: number, subcategoriaId: number): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM aux_subcategorias_produtos
      WHERE id_empresa = ? AND id_subcategoria = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, subcategoriaId]);
    return (result as any[]).length > 0;
  }

  static async findProdutoLink(
    empresaId: number,
    subcategoriaId: number,
    produtoId: number
  ): Promise<SubcategoriaProduto | null> {
    const sql = `
      SELECT id_empresa, id_subcategoria, id_produto
      FROM aux_subcategorias_produtos
      WHERE id_empresa = ? AND id_subcategoria = ? AND id_produto = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, subcategoriaId, produtoId]);
    return (result as SubcategoriaProduto[])[0] || null;
  }

  static async addProduto(
    empresaId: number,
    subcategoriaId: number,
    produtoId: number
  ): Promise<SubcategoriaProduto> {
    const sql = `
      INSERT INTO aux_subcategorias_produtos (id_empresa, id_subcategoria, id_produto)
      VALUES (?, ?, ?)
    `;
    await query(sql, [empresaId, subcategoriaId, produtoId]);
    return { id_empresa: empresaId, id_subcategoria: subcategoriaId, id_produto: produtoId };
  }

  static async removeProduto(
    empresaId: number,
    subcategoriaId: number,
    produtoId: number
  ): Promise<boolean> {
    const sql = `
      DELETE FROM aux_subcategorias_produtos
      WHERE id_empresa = ? AND id_subcategoria = ? AND id_produto = ?
    `;
    const result = await query(sql, [empresaId, subcategoriaId, produtoId]);
    return (result as any).affectedRows > 0;
  }

  static async findProdutos(
    empresaId: number,
    subcategoriaId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: SubcategoriaProduto[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    const values = [empresaId, subcategoriaId];
    const countResult = await query(
      `
        SELECT COUNT(*) as total
        FROM aux_subcategorias_produtos
        WHERE id_empresa = ? AND id_subcategoria = ?
      `,
      values
    );
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT id_empresa, id_subcategoria, id_produto
        FROM aux_subcategorias_produtos
        WHERE id_empresa = ? AND id_subcategoria = ?
        ORDER BY id_produto ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );
    return { items: items as SubcategoriaProduto[], total };
  }
}
