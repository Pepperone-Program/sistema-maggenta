import { query } from '@database/connection';
import type {
  CreateLandingPageDTO,
  LandingPage,
  UpdateLandingPageDTO,
} from '@/types/landing-page';

const columns = `
  ID AS id,
  TITLE AS title,
  DESCRIPTION AS description,
  KEYWORDS AS keywords,
  URL AS url,
  DATA_LP AS data_lp
`;

export class LandingPageModel {
  static async create(data: CreateLandingPageDTO): Promise<number> {
    const result = await query(
      `INSERT INTO landing_pages (TITLE, DESCRIPTION, KEYWORDS, URL, DATA_LP)
       VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
      [data.title, data.description || null, data.keywords, data.url, data.data_lp || null]
    );

    return (result as { insertId: number }).insertId;
  }

  static async findById(id: number): Promise<LandingPage | null> {
    const rows = await query(
      `SELECT ${columns} FROM landing_pages WHERE ID = ? LIMIT 1`,
      [id]
    );
    return (rows as LandingPage[])[0] || null;
  }

  static async findAll(
    page: number,
    limit: number,
    search?: string
  ): Promise<{ items: LandingPage[]; total: number }> {
    const where = search
      ? 'WHERE TITLE LIKE ? OR DESCRIPTION LIKE ? OR KEYWORDS LIKE ? OR URL LIKE ?'
      : '';
    const pattern = search ? `%${search}%` : undefined;
    const values = pattern ? [pattern, pattern, pattern, pattern] : [];
    const countRows = await query(
      `SELECT COUNT(*) AS total FROM landing_pages ${where}`,
      values
    );
    const items = await query(
      `SELECT ${columns}
       FROM landing_pages
       ${where}
       ORDER BY DATA_LP DESC, ID DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, (page - 1) * limit]
    );

    return {
      items: items as LandingPage[],
      total: Number((countRows as Array<{ total: number }>)[0]?.total || 0),
    };
  }

  static async update(id: number, data: UpdateLandingPageDTO): Promise<boolean> {
    const allowed = new Map<keyof UpdateLandingPageDTO, string>([
      ['title', 'TITLE'],
      ['description', 'DESCRIPTION'],
      ['keywords', 'KEYWORDS'],
      ['url', 'URL'],
      ['data_lp', 'DATA_LP'],
    ]);
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [field, column] of allowed) {
      if (data[field] !== undefined) {
        updates.push(`${column} = ?`);
        values.push(data[field] === '' ? null : data[field]);
      }
    }

    if (!updates.length) return true;
    const result = await query(
      `UPDATE landing_pages SET ${updates.join(', ')} WHERE ID = ?`,
      [...values, id]
    );
    return (result as { affectedRows: number }).affectedRows > 0;
  }

  static async delete(id: number): Promise<boolean> {
    const result = await query('DELETE FROM landing_pages WHERE ID = ?', [id]);
    return (result as { affectedRows: number }).affectedRows > 0;
  }
}
