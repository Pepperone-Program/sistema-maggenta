import { query } from '@database/connection';
import type { Banner, CreateBannerDTO, UpdateBannerDTO } from '@/types/banner';

const normalizeLimit = (limit: number): number => Math.min(Math.max(limit, 1), 500);
const normalizePage = (page: number): number => Math.max(page, 1);

const bannerColumns = `
  id_empresa,
  id_banner,
  tipo,
  titulo,
  url,
  id_tipo_produto,
  data_inicial,
  data_final,
  ordem,
  habilitado,
  cliques,
  url_banner
`;

export class BannerModel {
  static async create(empresaId: number, data: CreateBannerDTO): Promise<number> {
    const columns = [
      'id_empresa',
      'tipo',
      'titulo',
      'url',
      'id_tipo_produto',
      'data_inicial',
      'data_final',
      'ordem',
      'habilitado',
      'cliques',
      'url_banner',
    ];
    const placeholders = columns.map(() => '?');
    const values: any[] = [
      empresaId,
      data.tipo,
      data.titulo || null,
      data.url || null,
      data.id_tipo_produto ?? 0,
      data.data_inicial || null,
      data.data_final || null,
      data.ordem ?? 0,
      data.habilitado || 'S',
      data.cliques ?? null,
      data.url_banner || null,
    ];

    if (data.id_banner !== undefined) {
      columns.splice(1, 0, 'id_banner');
      placeholders.splice(1, 0, '?');
      values.splice(1, 0, data.id_banner);
    }

    const result = await query(
      `
        INSERT INTO banners (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
      `,
      values
    );

    return data.id_banner ?? (result as any).insertId;
  }

  static async findById(empresaId: number, bannerId: number): Promise<Banner | null> {
    const result = await query(
      `
        SELECT ${bannerColumns}
        FROM banners
        WHERE id_empresa = ? AND id_banner = ?
        LIMIT 1
      `,
      [empresaId, bannerId]
    );

    return (result as Banner[])[0] || null;
  }

  static async findAll(
    empresaId: number,
    page: number = 1,
    limit: number = 50,
    filters: { search?: string; habilitado?: string; tipo?: string } = {}
  ): Promise<{ items: Banner[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    let where = 'WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (filters.search) {
      where += ' AND (titulo LIKE ? OR url LIKE ? OR url_banner LIKE ?)';
      const searchPattern = `%${filters.search}%`;
      values.push(searchPattern, searchPattern, searchPattern);
    }

    if (filters.habilitado) {
      where += ' AND habilitado = ?';
      values.push(filters.habilitado);
    }

    if (filters.tipo) {
      where += ' AND tipo = ?';
      values.push(filters.tipo);
    }

    const countResult = await query(`SELECT COUNT(*) as total FROM banners ${where}`, values);
    const total = (countResult as any[])[0].total;

    const items = await query(
      `
        SELECT ${bannerColumns}
        FROM banners
        ${where}
        ORDER BY tipo ASC, ordem ASC, id_banner ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );

    return { items: items as Banner[], total };
  }

  static async findActiveByTipo(empresaId: number, tipo?: string): Promise<Banner[]> {
    let where = 'WHERE id_empresa = ? AND habilitado = ?';
    const values: any[] = [empresaId, 'S'];

    if (tipo) {
      where += ' AND tipo = ?';
      values.push(tipo);
    }

    const result = await query(
      `
        SELECT ${bannerColumns}
        FROM banners
        ${where}
        ORDER BY tipo ASC, ordem ASC, id_banner ASC
      `,
      values
    );

    return result as Banner[];
  }

  static async update(empresaId: number, bannerId: number, data: UpdateBannerDTO): Promise<boolean> {
    const allowedColumns = [
      'tipo',
      'titulo',
      'url',
      'id_tipo_produto',
      'data_inicial',
      'data_final',
      'ordem',
      'habilitado',
      'cliques',
      'url_banner',
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

    const result = await query(
      `
        UPDATE banners
        SET ${updates.join(', ')}
        WHERE id_empresa = ? AND id_banner = ?
      `,
      [...values, empresaId, bannerId]
    );

    return (result as any).affectedRows > 0;
  }

  static async delete(empresaId: number, bannerId: number): Promise<boolean> {
    const result = await query('DELETE FROM banners WHERE id_empresa = ? AND id_banner = ?', [
      empresaId,
      bannerId,
    ]);

    return (result as any).affectedRows > 0;
  }

  static async reorder(empresaId: number, bannerIds: number[]): Promise<void> {
    if (!bannerIds.length) return;

    const placeholders = bannerIds.map(() => '?').join(',');
    const rows = (await query(
      `
        SELECT id_banner
        FROM banners
        WHERE id_empresa = ? AND id_banner IN (${placeholders})
      `,
      [empresaId, ...bannerIds]
    )) as Array<{ id_banner: number }>;

    if (rows.length !== bannerIds.length) {
      const error = new Error('A nova ordem contem banners invalidos') as Error & {
        code: string;
        statusCode: number;
      };
      error.code = 'INVALID_ORDER';
      error.statusCode = 400;
      throw error;
    }

    const caseSql = bannerIds.map(() => 'WHEN ? THEN ?').join(' ');
    const caseValues = bannerIds.flatMap((idBanner, index) => [idBanner, index + 1]);

    await query(
      `
        UPDATE banners
        SET ordem = CASE id_banner ${caseSql} ELSE ordem END
        WHERE id_empresa = ? AND id_banner IN (${placeholders})
      `,
      [...caseValues, empresaId, ...bannerIds]
    );
  }
}
