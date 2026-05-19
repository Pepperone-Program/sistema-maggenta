import { query } from '@database/connection';
import type {
  CreateDataPromocionalDTO,
  DataPromocional,
  DataPromocionalProduto,
  UpdateDataPromocionalDTO,
} from '@/types/data-promocional';

const normalizeLimit = (limit: number): number => Math.min(Math.max(limit, 1), 100);
const normalizePage = (page: number): number => Math.max(page, 1);

export class DataPromocionalModel {
  static async create(data: CreateDataPromocionalDTO): Promise<number> {
    const columns = ['data_promocional', 'data', 'descricao', 'ordem', 'habilitado'];
    const placeholders = ['?', '?', '?', '?', '?'];
    const values: any[] = [
      data.data_promocional,
      data.data || null,
      data.descricao || null,
      data.ordem ?? 0,
      data.habilitado || 'S',
    ];

    if (data.id_data_promocional !== undefined) {
      columns.unshift('id_data_promocional');
      placeholders.unshift('?');
      values.unshift(data.id_data_promocional);
    }

    const sql = `
      INSERT INTO datas_promocionais (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;
    const result = await query(sql, values);
    return data.id_data_promocional ?? (result as any).insertId;
  }

  static async findById(dataPromocionalId: number): Promise<DataPromocional | null> {
    const sql = `
      SELECT id_data_promocional, data_promocional, data, descricao, ordem, habilitado
      FROM datas_promocionais
      WHERE id_data_promocional = ?
      LIMIT 1
    `;
    const result = await query(sql, [dataPromocionalId]);
    return (result as DataPromocional[])[0] || null;
  }

  static async findByName(dataPromocional: string): Promise<DataPromocional | null> {
    const sql = `
      SELECT id_data_promocional, data_promocional, data, descricao, ordem, habilitado
      FROM datas_promocionais
      WHERE LOWER(data_promocional) = ?
      LIMIT 1
    `;
    const result = await query(sql, [dataPromocional.trim().toLowerCase()]);
    return (result as DataPromocional[])[0] || null;
  }

  static async findAll(
    page: number = 1,
    limit: number = 100,
    search?: string,
    habilitado?: string
  ): Promise<{ items: DataPromocional[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    let where = '';
    const values: any[] = [];

    if (search) {
      where = 'WHERE (data_promocional LIKE ? OR descricao LIKE ?)';
      values.push(`%${search}%`, `%${search}%`);
    }

    if (habilitado) {
      where += where ? ' AND habilitado = ?' : 'WHERE habilitado = ?';
      values.push(habilitado);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM datas_promocionais ${where}`,
      values
    );
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT id_data_promocional, data_promocional, data, descricao, ordem, habilitado
        FROM datas_promocionais
        ${where}
        ORDER BY ordem ASC, data_promocional ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );
    return { items: items as DataPromocional[], total };
  }

  static async update(
    dataPromocionalId: number,
    data: UpdateDataPromocionalDTO
  ): Promise<boolean> {
    const allowedColumns = ['data_promocional', 'data', 'descricao', 'ordem', 'habilitado'];
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
      UPDATE datas_promocionais
      SET ${updates.join(', ')}
      WHERE id_data_promocional = ?
    `;
    const result = await query(sql, [...values, dataPromocionalId]);
    return (result as any).affectedRows > 0;
  }

  static async delete(dataPromocionalId: number): Promise<boolean> {
    const sql = 'DELETE FROM datas_promocionais WHERE id_data_promocional = ?';
    const result = await query(sql, [dataPromocionalId]);
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

  static async hasProdutos(dataPromocionalId: number): Promise<boolean> {
    const sql = `
      SELECT 1
      FROM aux_datas_promocionais_produtos
      WHERE id_data_promocional = ?
      LIMIT 1
    `;
    const result = await query(sql, [dataPromocionalId]);
    return (result as any[]).length > 0;
  }

  static async findProdutoLink(
    dataPromocionalId: number,
    produtoId: number
  ): Promise<DataPromocionalProduto | null> {
    const sql = `
      SELECT id_data_promocional, id_produto
      FROM aux_datas_promocionais_produtos
      WHERE id_data_promocional = ? AND id_produto = ?
      LIMIT 1
    `;
    const result = await query(sql, [dataPromocionalId, produtoId]);
    return (result as DataPromocionalProduto[])[0] || null;
  }

  static async addProduto(
    dataPromocionalId: number,
    produtoId: number
  ): Promise<DataPromocionalProduto> {
    const sql = `
      INSERT INTO aux_datas_promocionais_produtos (id_data_promocional, id_produto)
      VALUES (?, ?)
    `;
    await query(sql, [dataPromocionalId, produtoId]);
    return { id_data_promocional: dataPromocionalId, id_produto: produtoId };
  }

  static async removeProduto(dataPromocionalId: number, produtoId: number): Promise<boolean> {
    const sql = `
      DELETE FROM aux_datas_promocionais_produtos
      WHERE id_data_promocional = ? AND id_produto = ?
    `;
    const result = await query(sql, [dataPromocionalId, produtoId]);
    return (result as any).affectedRows > 0;
  }

  static async findProdutos(
    dataPromocionalId: number,
    page: number = 1,
    limit: number = 100
  ): Promise<{ items: DataPromocionalProduto[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    const countResult = await query(
      `
        SELECT COUNT(*) as total
        FROM aux_datas_promocionais_produtos
        WHERE id_data_promocional = ?
      `,
      [dataPromocionalId]
    );
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT id_data_promocional, id_produto
        FROM aux_datas_promocionais_produtos
        WHERE id_data_promocional = ?
        ORDER BY id_produto ASC
        LIMIT ? OFFSET ?
      `,
      [dataPromocionalId, safeLimit, (safePage - 1) * safeLimit]
    );
    return { items: items as DataPromocionalProduto[], total };
  }
}
