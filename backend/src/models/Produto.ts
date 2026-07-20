import { getConnection, query } from '@database/connection';
import type {
  Produto,
  ProdutoCategoria,
  ProdutoImagem,
  CreateProdutoDTO,
  UpdateProdutoDTO,
  ProdutoExportacao,
} from '@/types/produto';

export class ProdutoModel {
  static async findAllForXmlFeed(empresaId: number): Promise<Produto[]> {
    return (await query(
      `
        SELECT *
        FROM produtos
        WHERE id_empresa = ?
          AND site = 'S'
        ORDER BY id_produto ASC
      `,
      [empresaId]
    )) as Produto[];
  }

  static async findAllForSpreadsheet(empresaId: number): Promise<ProdutoExportacao[]> {
    return (await query(
      `
        SELECT
          p.codigo,
          p.produto,
          p.descricao,
          p.quantidade_minima,
          (
            SELECT ip.url_imagem
            FROM imagens_produtos ip
            WHERE ip.id_produto = p.id_produto
              AND ip.ordem_imagem = 1
            ORDER BY ip.id_imagem ASC
            LIMIT 1
          ) AS url_imagem
        FROM produtos p
        WHERE p.id_empresa = ?
          AND p.site = 'S'
        ORDER BY p.produto ASC, p.id_produto ASC
      `,
      [empresaId]
    )) as ProdutoExportacao[];
  }

  static async create(
    empresaId: number,
    data: CreateProdutoDTO
    ): Promise<any> {
    const sql = `
      INSERT INTO produtos (
        id_empresa, id_tipo_produto, produto, descricao, codigo,
        id_tipo_gravacao_padrao, altura, largura, profundidade, peso,
        caixa1, caixa2, caixa3, caixa4, caixa5, ncm, imagem,
        data_inclusao, data_inicial, data_final, obs, site,
        sugerir_sempre, lancamento, promocao, premium, marketplace,
        video, habilitado, cod_forn, quantidade_minima
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const values = [
      empresaId,
      data.id_tipo_produto,
      data.produto,
      data.descricao || null,
      data.codigo,
      data.id_tipo_gravacao_padrao || 0,
      data.altura || null,
      data.largura || null,
      data.profundidade || null,
      data.peso || null,
      data.caixa1 || null,
      data.caixa2 || null,
      data.caixa3 || null,
      data.caixa4 || null,
      data.caixa5 || null,
      data.ncm || null,
      data.imagem || null,
      data.data_inicial || null,
      data.data_final || null,
      data.obs || null,
      data.site || 'N',
      data.sugerir_sempre || 'N',
      data.lancamento || 'N',
      data.promocao || 'N',
      data.premium || 'N',
      data.marketplace || 'N',
      data.video || null,
      data.habilitado || 'S',
      data.cod_forn || null,
      data.quantidade_minima || null,
    ];

    const result = await query(sql, values);
    return (result as any).insertId;
  }

  static async findById(
    empresaId: number,
    produtoId: number
  ): Promise<Produto | null> {
    const sql = 'SELECT * FROM produtos WHERE id_empresa = ? AND id_produto = ?';
    const result = await query(sql, [empresaId, produtoId]);
    return (result as any[])[0] || null;
  }

  static async findByIdForSite(
    empresaId: number,
    produtoId: number
  ): Promise<Produto | null> {
    const sql = `
      SELECT *
      FROM produtos
      WHERE id_empresa = ?
        AND id_produto = ?
        AND habilitado = 'S'
        AND site = 'S'
    `;
    const result = await query(sql, [empresaId, produtoId]);
    return (result as any[])[0] || null;
  }

  static async findImagesByProductIds(produtoIds: number[]): Promise<Map<number, ProdutoImagem[]>> {
    const imagesByProduct = new Map<number, ProdutoImagem[]>();
    const uniqueIds = Array.from(new Set(produtoIds.filter((id) => Number.isInteger(id) && id > 0)));

    if (!uniqueIds.length) {
      return imagesByProduct;
    }

    const chunkSize = 1000;

    for (let start = 0; start < uniqueIds.length; start += chunkSize) {
      const chunk = uniqueIds.slice(start, start + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const rows = (await query(
        `
          SELECT id_imagem, id_produto, url_imagem, ordem_imagem, created_at
          FROM imagens_produtos
          WHERE id_produto IN (${placeholders})
          ORDER BY id_produto ASC, ordem_imagem ASC, id_imagem ASC
        `,
        chunk
      )) as ProdutoImagem[];

      for (const image of rows) {
        const produtoId = Number(image.id_produto);
        const current = imagesByProduct.get(produtoId) || [];
        current.push(image);
        imagesByProduct.set(produtoId, current);
      }
    }

    return imagesByProduct;
  }

  static async findCategoriesByProductIds(
    empresaId: number,
    produtoIds: number[]
  ): Promise<Map<number, ProdutoCategoria[]>> {
    const categoriesByProduct = new Map<number, ProdutoCategoria[]>();
    const uniqueIds = Array.from(new Set(produtoIds.filter((id) => Number.isInteger(id) && id > 0)));

    if (!uniqueIds.length) {
      return categoriesByProduct;
    }

    const chunkSize = 1000;

    for (let start = 0; start < uniqueIds.length; start += chunkSize) {
      const chunk = uniqueIds.slice(start, start + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const rows = (await query(
        `
          SELECT acp.id_produto, c.id_categoria, c.categoria
          FROM aux_categorias_produtos acp
          INNER JOIN categorias c
            ON c.id_empresa = acp.id_empresa AND c.id_categoria = acp.id_categoria
          WHERE acp.id_empresa = ? AND acp.id_produto IN (${placeholders})
          ORDER BY c.categoria ASC, c.id_categoria ASC
        `,
        [empresaId, ...chunk]
      )) as Array<ProdutoCategoria & { id_produto: number }>;

      for (const row of rows) {
        const produtoId = Number(row.id_produto);
        const current = categoriesByProduct.get(produtoId) || [];
        current.push({
          id_categoria: row.id_categoria,
          categoria: row.categoria,
        });
        categoriesByProduct.set(produtoId, current);
      }
    }

    return categoriesByProduct;
  }

  static async findImagesByProductId(produtoId: number): Promise<ProdutoImagem[]> {
    const rows = (await query(
      `
        SELECT id_imagem, id_produto, url_imagem, ordem_imagem, created_at
        FROM imagens_produtos
        WHERE id_produto = ?
        ORDER BY ordem_imagem ASC, id_imagem ASC
      `,
      [produtoId]
    )) as ProdutoImagem[];

    return rows;
  }

  static async insertImage(produtoId: number, urlImagem: string, ordemImagem: number): Promise<number> {
    const result = (await query(
      `
        INSERT INTO imagens_produtos (id_produto, url_imagem, ordem_imagem)
        VALUES (?, ?, ?)
      `,
      [produtoId, urlImagem, ordemImagem]
    )) as { insertId: number };

    return result.insertId;
  }

  static async deleteImage(produtoId: number, imageId: number): Promise<boolean> {
    const result = (await query(
      `
        DELETE FROM imagens_produtos
        WHERE id_produto = ? AND id_imagem = ?
      `,
      [produtoId, imageId]
    )) as { affectedRows: number };

    return result.affectedRows > 0;
  }

  static async findProductLinks(produtoId: number) {
    const [categorias, subcategorias, publicosAlvos, datasPromocionais] = await Promise.all([
      query(
        `
          SELECT c.id_categoria, c.categoria, c.habilitado
          FROM aux_categorias_produtos acp
          INNER JOIN categorias c
            ON c.id_empresa = acp.id_empresa AND c.id_categoria = acp.id_categoria
          WHERE acp.id_produto = ?
          ORDER BY c.categoria ASC
        `,
        [produtoId]
      ),
      query(
        `
          SELECT
            asp.id_empresa,
            asp.id_subcategoria,
            asp.id_produto,
            COALESCE(
              s.id_categoria,
              (
                SELECT sf.id_categoria
                FROM subcategorias sf
                WHERE sf.id_subcategoria = asp.id_subcategoria
                ORDER BY sf.id_empresa ASC
                LIMIT 1
              )
            ) as id_categoria,
            COALESCE(
              s.subcategoria,
              (
                SELECT sf.subcategoria
                FROM subcategorias sf
                WHERE sf.id_subcategoria = asp.id_subcategoria
                ORDER BY sf.id_empresa ASC
                LIMIT 1
              ),
              CONCAT('Subcategoria #', asp.id_subcategoria)
            ) as subcategoria,
            COALESCE(
              s.habilitado,
              (
                SELECT sf.habilitado
                FROM subcategorias sf
                WHERE sf.id_subcategoria = asp.id_subcategoria
                ORDER BY sf.id_empresa ASC
                LIMIT 1
              )
            ) as habilitado,
            COALESCE(
              c.categoria,
              (
                SELECT cf.categoria
                FROM subcategorias sf
                LEFT JOIN categorias cf
                  ON cf.id_empresa = sf.id_empresa AND cf.id_categoria = sf.id_categoria
                WHERE sf.id_subcategoria = asp.id_subcategoria
                ORDER BY sf.id_empresa ASC
                LIMIT 1
              )
            ) as categoria
          FROM aux_subcategorias_produtos asp
          LEFT JOIN subcategorias s
            ON s.id_empresa = asp.id_empresa AND s.id_subcategoria = asp.id_subcategoria
          LEFT JOIN categorias c
            ON c.id_empresa = s.id_empresa AND c.id_categoria = s.id_categoria
          WHERE asp.id_produto = ?
          ORDER BY asp.id_empresa ASC, c.categoria ASC, s.ordem ASC, s.subcategoria ASC, asp.id_subcategoria ASC
        `,
        [produtoId]
      ),
      query(
        `
          SELECT pa.id_publico_alvo, pa.publico_alvo, pa.habilitado
          FROM aux_publicos_alvos_produtos app
          INNER JOIN publicos_alvos pa
            ON pa.id_publico_alvo = app.id_publico_alvo
          WHERE app.id_produto = ?
          ORDER BY pa.ordem ASC, pa.publico_alvo ASC
        `,
        [produtoId]
      ),
      query(
        `
          SELECT dp.id_data_promocional, dp.data_promocional, dp.data, dp.habilitado
          FROM aux_datas_promocionais_produtos adp
          INNER JOIN datas_promocionais dp
            ON dp.id_data_promocional = adp.id_data_promocional
          WHERE adp.id_produto = ?
          ORDER BY dp.ordem ASC, dp.data_promocional ASC
        `,
        [produtoId]
      ),
    ]);

    return {
      categorias,
      subcategorias,
      publicos_alvos: publicosAlvos,
      datas_promocionais: datasPromocionais,
    };
  }

  static async findSubcategoryOptionsForProduct(
    empresaId: number,
    produtoId: number
  ) {
    return query(
      `
        SELECT
          s.id_empresa,
          s.id_subcategoria,
          s.id_categoria,
          s.subcategoria,
          s.habilitado,
          c.categoria,
          (
            SELECT asp.id_empresa
            FROM aux_subcategorias_produtos asp
            WHERE asp.id_subcategoria = s.id_subcategoria
              AND asp.id_produto = ?
            ORDER BY asp.id_empresa ASC
            LIMIT 1
          ) as id_empresa_vinculo,
          (
            SELECT asp.id_produto
            FROM aux_subcategorias_produtos asp
            WHERE asp.id_subcategoria = s.id_subcategoria
              AND asp.id_produto = ?
            ORDER BY asp.id_empresa ASC
            LIMIT 1
          ) as id_produto,
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM aux_subcategorias_produtos asp
              WHERE asp.id_subcategoria = s.id_subcategoria
                AND asp.id_produto = ?
            ) THEN 1
            ELSE 0
          END as vinculado
        FROM subcategorias s
        LEFT JOIN categorias c
          ON c.id_empresa = s.id_empresa AND c.id_categoria = s.id_categoria
        WHERE s.id_empresa = ?
        ORDER BY c.categoria ASC, s.ordem ASC, s.subcategoria ASC
      `,
      [produtoId, produtoId, produtoId, empresaId]
    );
  }

  static async removeSubcategoryLink(
    empresaId: number,
    produtoId: number,
    subcategoriaId: number
  ): Promise<boolean> {
    const result = await query(
      `
        DELETE FROM aux_subcategorias_produtos
        WHERE id_empresa = ? AND id_produto = ? AND id_subcategoria = ?
      `,
      [empresaId, produtoId, subcategoriaId]
    );
    return (result as any).affectedRows > 0;
  }

  static async reorderImages(produtoId: number, imageIds: number[]): Promise<void> {
    if (!imageIds.length) return;

    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const placeholders = imageIds.map(() => '?').join(',');
      const rows = (await connection.execute(
        `
          SELECT id_imagem
          FROM imagens_produtos
          WHERE id_produto = ? AND id_imagem IN (${placeholders})
          FOR UPDATE
        `,
        [produtoId, ...imageIds]
      ).then(([result]) => result)) as Array<{ id_imagem: number }>;

      if (rows.length !== imageIds.length) {
        const error = new Error('A nova ordem contem imagens invalidas para este produto') as Error & {
          code: string;
          statusCode: number;
        };
        error.code = 'INVALID_ORDER';
        error.statusCode = 400;
        throw error;
      }

      const temporaryCase = imageIds.map(() => 'WHEN ? THEN ?').join(' ');
      const temporaryValues = imageIds.flatMap((idImagem, index) => [idImagem, -(index + 1)]);
      await connection.execute(
        `
          UPDATE imagens_produtos
          SET ordem_imagem = CASE id_imagem ${temporaryCase} END
          WHERE id_produto = ? AND id_imagem IN (${placeholders})
        `,
        [...temporaryValues, produtoId, ...imageIds]
      );

      const finalCase = imageIds.map(() => 'WHEN ? THEN ?').join(' ');
      const finalValues = imageIds.flatMap((idImagem, index) => [idImagem, index + 1]);
      await connection.execute(
        `
          UPDATE imagens_produtos
          SET ordem_imagem = CASE id_imagem ${finalCase} END
          WHERE id_produto = ? AND id_imagem IN (${placeholders})
        `,
        [...finalValues, produtoId, ...imageIds]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async findAll(
    empresaId: number,
    page: number = 1,
    limit: number = 100,
    search?: string,
    habilitado?: string,
    site?: string
  ): Promise<{ items: Produto[]; total: number }> {
    let sql = 'SELECT * FROM produtos WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (search) {
      const numericSearch = Number(search);
      sql += ` AND (produto LIKE ? OR codigo LIKE ? OR descricao LIKE ?${Number.isInteger(numericSearch) ? ' OR id_produto = ?' : ''})`;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern);
      if (Number.isInteger(numericSearch)) values.push(numericSearch);
    }

    if (habilitado === 'S' || habilitado === 'N') {
      sql += ' AND habilitado = ?';
      values.push(habilitado);
    }

    if (site === 'S' || site === 'N') {
      sql += ' AND site = ?';
      values.push(site);
    }

    const countResult = await query(
      sql.replace('SELECT *', 'SELECT COUNT(*) as total'),
      values
    );
    const total = (countResult as any[])[0].total;

    const offset = (page - 1) * limit;
    sql += ` ORDER BY data_modificacao DESC LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    const items = await query(sql, values);
    return { items: items as Produto[], total };
  }

  static async findAllForSite(
    empresaId: number,
    page: number = 1,
    limit: number = 100,
    search?: string
  ): Promise<{ items: Produto[]; total: number }> {
    let sql = "SELECT * FROM produtos WHERE id_empresa = ? AND site = 'S' AND habilitado = 'S'";
    const values: any[] = [empresaId];

    if (search) {
      sql += ` AND (produto LIKE ? OR codigo LIKE ? OR descricao LIKE ?)`;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern);
    }

    const countResult = await query(
      sql.replace('SELECT *', 'SELECT COUNT(*) as total'),
      values
    );
    const total = (countResult as any[])[0].total;

    const offset = (page - 1) * limit;
    sql += ` ORDER BY data_modificacao DESC LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    const items = await query(sql, values);
    return { items: items as Produto[], total };
  }

  static async searchForSite(
    empresaId: number,
    term: string,
    page: number = 1,
    limit: number = 100
  ): Promise<{ items: Produto[]; total: number }> {
    const words = term
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);
    const productConditions = words.length
      ? words.map(() => 'produto LIKE ?').join(' AND ')
      : 'produto LIKE ?';
    const searchValues = words.length ? words.map((word) => `%${word}%`) : [`%${term}%`];
    let sql = `
      SELECT *
      FROM produtos
      WHERE id_empresa = ?
        AND site = 'S'
        AND habilitado = 'S'
        AND ${productConditions}
    `;
    const values: any[] = [empresaId, ...searchValues];

    const countResult = await query(
      sql.replace('SELECT *', 'SELECT COUNT(*) as total'),
      values
    );
    const total = (countResult as any[])[0].total;

    const offset = (page - 1) * limit;
    sql += `
      ORDER BY
        CASE
          WHEN codigo = ? THEN 0
          WHEN cod_forn = ? THEN 1
          WHEN produto = ? THEN 2
          WHEN produto LIKE ? THEN 3
          ELSE 5
        END,
        data_modificacao DESC
      LIMIT ? OFFSET ?
    `;
    values.push(term, term, term, `${term}%`, limit, offset);

    const items = await query(sql, values);
    return { items: items as Produto[], total };
  }

  static async searchByCodigoForSite(
    empresaId: number,
    codigo: string
  ): Promise<Pick<Produto, 'id_produto' | 'codigo'> | null> {
    const result = await query(
      `
        SELECT id_produto, codigo
        FROM produtos
        WHERE id_empresa = ?
          AND site = 'S'
          AND habilitado = 'S'
          AND codigo = ?
        LIMIT 1
      `,
      [empresaId, codigo]
    );

    return (result as Array<Pick<Produto, 'id_produto' | 'codigo'>>)[0] || null;
  }

  static async searchByCodigoLikeForSite(
    empresaId: number,
    codigo: string,
    page: number = 1,
    limit: number = 100
  ): Promise<{ items: Produto[]; total: number }> {
    const sql = `
      SELECT *
      FROM produtos
      WHERE id_empresa = ?
        AND site = 'S'
        AND habilitado = 'S'
        AND codigo LIKE ?
    `;
    const values: any[] = [empresaId, `%${codigo}%`];

    const countResult = await query(
      sql.replace('SELECT *', 'SELECT COUNT(*) as total'),
      values
    );
    const total = (countResult as any[])[0].total;

    const offset = (page - 1) * limit;
    const items = await query(
      `${sql}
        ORDER BY
          CASE
            WHEN codigo LIKE ? THEN 0
            ELSE 1
          END,
          produto ASC,
          id_produto ASC
        LIMIT ? OFFSET ?
      `,
      [...values, `${codigo}%`, limit, offset]
    );

    return { items: items as Produto[], total };
  }

  static async update(
    empresaId: number,
    produtoId: number,
    data: UpdateProdutoDTO
  ): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      updates.push(`${key} = ?`);
      values.push(value ?? null);
    });

    updates.push('data_modificacao = NOW()');
    values.push(empresaId, produtoId);

    const sql = `
      UPDATE produtos
      SET ${updates.join(', ')}
      WHERE id_empresa = ? AND id_produto = ?
    `;

    const result = await query(sql, values);
    return (result as any).affectedRows > 0;
  }

  static async delete(empresaId: number, produtoId: number): Promise<boolean> {
    const sql = 'DELETE FROM produtos WHERE id_empresa = ? AND id_produto = ?';
    const result = await query(sql, [empresaId, produtoId]);
    return (result as any).affectedRows > 0;
  }

  static async updateImage(
    empresaId: number,
    produtoId: number,
    filename: string | null
  ): Promise<boolean> {
    const sql = `
      UPDATE produtos
      SET imagem = ?, data_modificacao = NOW()
      WHERE id_empresa = ? AND id_produto = ?
    `;
    const result = await query(sql, [filename, empresaId, produtoId]);
    return (result as any).affectedRows > 0;
  }

  static async searchByCodigo(
    empresaId: number,
    codigo: string
  ): Promise<Produto | null> {
    const sql =
      'SELECT * FROM produtos WHERE id_empresa = ? AND codigo = ? LIMIT 1';
    const result = await query(sql, [empresaId, codigo]);
    return (result as any[])[0] || null;
  }
}
