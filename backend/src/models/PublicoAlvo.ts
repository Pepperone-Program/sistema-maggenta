import { query } from '@database/connection';
import type {
  CreatePublicoAlvoDTO,
  PublicoAlvo,
  PublicoAlvoProduto,
  UpdatePublicoAlvoDTO,
} from '@/types/publico-alvo';

const normalizeLimit = (limit: number): number => Math.min(Math.max(limit, 1), 100);
const normalizePage = (page: number): number => Math.max(page, 1);

export class PublicoAlvoModel {
  static async create(data: CreatePublicoAlvoDTO): Promise<number> {
    const columns = ['publico_alvo', 'descricao', 'ordem', 'habilitado'];
    const placeholders = ['?', '?', '?', '?'];
    const values: any[] = [
      data.publico_alvo,
      data.descricao || null,
      data.ordem ?? 0,
      data.habilitado || 'S',
    ];

    if (data.id_publico_alvo !== undefined) {
      columns.unshift('id_publico_alvo');
      placeholders.unshift('?');
      values.unshift(data.id_publico_alvo);
    }

    const sql = `
      INSERT INTO publicos_alvos (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;
    const result = await query(sql, values);
    return data.id_publico_alvo ?? (result as any).insertId;
  }

  static async findById(publicoAlvoId: number): Promise<PublicoAlvo | null> {
    const sql = `
      SELECT id_publico_alvo, publico_alvo, descricao, ordem, habilitado
      FROM publicos_alvos
      WHERE id_publico_alvo = ?
      LIMIT 1
    `;
    const result = await query(sql, [publicoAlvoId]);
    return (result as PublicoAlvo[])[0] || null;
  }

  static async findByName(publicoAlvo: string): Promise<PublicoAlvo | null> {
    const sql = `
      SELECT id_publico_alvo, publico_alvo, descricao, ordem, habilitado
      FROM publicos_alvos
      WHERE LOWER(publico_alvo) = ?
      LIMIT 1
    `;
    const result = await query(sql, [publicoAlvo.trim().toLowerCase()]);
    return (result as PublicoAlvo[])[0] || null;
  }

  static async findAll(
    page: number = 1,
    limit: number = 100,
    search?: string,
    habilitado?: string
  ): Promise<{ items: PublicoAlvo[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    let where = '';
    const values: any[] = [];

    if (search) {
      where = 'WHERE (publico_alvo LIKE ? OR descricao LIKE ?)';
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern);
    }

    if (habilitado) {
      where += where ? ' AND habilitado = ?' : 'WHERE habilitado = ?';
      values.push(habilitado);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM publicos_alvos ${where}`,
      values
    );
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT id_publico_alvo, publico_alvo, descricao, ordem, habilitado
        FROM publicos_alvos
        ${where}
        ORDER BY ordem ASC, publico_alvo ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );
    return { items: items as PublicoAlvo[], total };
  }

  static async update(
    publicoAlvoId: number,
    data: UpdatePublicoAlvoDTO
  ): Promise<boolean> {
    const allowedColumns = ['publico_alvo', 'descricao', 'ordem', 'habilitado'];
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
      UPDATE publicos_alvos
      SET ${updates.join(', ')}
      WHERE id_publico_alvo = ?
    `;
    const result = await query(sql, [...values, publicoAlvoId]);
    return (result as any).affectedRows > 0;
  }

  static async delete(publicoAlvoId: number): Promise<boolean> {
    const sql = 'DELETE FROM publicos_alvos WHERE id_publico_alvo = ?';
    const result = await query(sql, [publicoAlvoId]);
    return (result as any).affectedRows > 0;
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

  static async hasProdutos(publicoAlvoId: number): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM aux_publicos_alvos_produtos
      WHERE id_publico_alvo = ?
      LIMIT 1
    `;
    const result = await query(sql, [publicoAlvoId]);
    return (result as any[]).length > 0;
  }

  static async findProdutoLink(
    publicoAlvoId: number,
    produtoId: number
  ): Promise<PublicoAlvoProduto | null> {
    const sql = `
      SELECT id_publico_alvo, id_produto
      FROM aux_publicos_alvos_produtos
      WHERE id_publico_alvo = ? AND id_produto = ?
      LIMIT 1
    `;
    const result = await query(sql, [publicoAlvoId, produtoId]);
    return (result as PublicoAlvoProduto[])[0] || null;
  }

  static async addProduto(
    publicoAlvoId: number,
    produtoId: number
  ): Promise<PublicoAlvoProduto> {
    const sql = `
      INSERT INTO aux_publicos_alvos_produtos (id_publico_alvo, id_produto)
      VALUES (?, ?)
    `;
    await query(sql, [publicoAlvoId, produtoId]);
    return { id_publico_alvo: publicoAlvoId, id_produto: produtoId };
  }

  static async removeProduto(publicoAlvoId: number, produtoId: number): Promise<boolean> {
    const sql = `
      DELETE FROM aux_publicos_alvos_produtos
      WHERE id_publico_alvo = ? AND id_produto = ?
    `;
    const result = await query(sql, [publicoAlvoId, produtoId]);
    return (result as any).affectedRows > 0;
  }

  static async findProdutos(
    publicoAlvoId: number,
    page: number = 1,
    limit: number = 100
  ): Promise<{ items: PublicoAlvoProduto[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    const countResult = await query(
      `
        SELECT COUNT(*) as total
        FROM aux_publicos_alvos_produtos
        WHERE id_publico_alvo = ?
      `,
      [publicoAlvoId]
    );
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT id_publico_alvo, id_produto
        FROM aux_publicos_alvos_produtos
        WHERE id_publico_alvo = ?
        ORDER BY id_produto ASC
        LIMIT ? OFFSET ?
      `,
      [publicoAlvoId, safeLimit, (safePage - 1) * safeLimit]
    );
    return { items: items as PublicoAlvoProduto[], total };
  }
}
