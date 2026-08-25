import { getConnection, query } from '@database/connection';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  OrcamentoItem,
  CreateOrcamentoItemDTO,
  UpdateOrcamentoItemDTO,
} from '@/types/orcamento-item';

export class OrcamentoItemModel {
  static async createIdempotent(
    data: CreateOrcamentoItemDTO,
    fingerprint: string
  ): Promise<{ id: number; created: boolean }> {
    const connection = await getConnection();
    const lockName = `orcamento-item:${fingerprint.slice(0, 43)}`;
    let locked = false;
    try {
      const [lockRows] = await connection.execute<RowDataPacket[]>('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
      locked = Number(lockRows[0]?.acquired) === 1;
      if (!locked) throw new Error('Nao foi possivel obter a trava de idempotencia do item');

      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT id_item FROM orcamentos_itens
        WHERE id_orcamento = ? AND id_produto = ? AND codigo = ? AND produto = ?
          AND COALESCE(produto_cor, '') = ? AND COALESCE(id_tipo_gravacao, '') = ?
          AND gravacao_cores = ? AND quantidade = ?
          AND COALESCE(preco_unitario, '') = ?
          AND COALESCE(bv, '') = ? AND COALESCE(margem_lucro, '') = ?
          AND COALESCE(preco_unitario_final, '') = ?
          AND COALESCE(preco_unitario_aprovado, '') = ?
          AND COALESCE(preco_unitario_frete, '') = ? AND COALESCE(frete_diluido, 'N') = ?
        ORDER BY id_item ASC LIMIT 1
      `, [
        data.id_orcamento, data.id_produto, data.codigo, data.produto,
        String(data.produto_cor || ''), String(data.id_tipo_gravacao || ''),
        data.gravacao_cores, data.quantidade, String(data.preco_unitario || ''),
        String(data.bv || ''), String(data.margem_lucro || ''),
        String(data.preco_unitario_final || ''), String(data.preco_unitario_aprovado || ''),
        String(data.preco_unitario_frete || ''), String(data.frete_diluido || 'N'),
      ]);
      const existingId = Number(rows[0]?.id_item);
      if (Number.isInteger(existingId) && existingId > 0) return { id: existingId, created: false };

      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO orcamentos_itens (
          id_orcamento, data_orcamento, id_produto, codigo, produto,
          produto_cor, id_tipo_gravacao, gravacao_cores, quantidade,
          bv, preco_unitario, margem_lucro, preco_unitario_final,
          preco_unitario_aprovado, preco_unitario_frete, frete_diluido
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, this.createValues(data));
      return { id: result.insertId, created: true };
    } finally {
      if (locked) await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
      connection.release();
    }
  }

  private static createValues(data: CreateOrcamentoItemDTO): any[] {
    return [
      data.id_orcamento, data.data_orcamento || new Date(), data.id_produto, data.codigo,
      data.produto, data.produto_cor || null, data.id_tipo_gravacao || null,
      data.gravacao_cores, data.quantidade, data.bv || null, data.preco_unitario || null,
      data.margem_lucro || null, data.preco_unitario_final || null,
      data.preco_unitario_aprovado || null, data.preco_unitario_frete || null,
      data.frete_diluido || 'N',
    ];
  }

  static async findById(itemId: number): Promise<OrcamentoItem | null> {
    const sql = 'SELECT * FROM orcamentos_itens WHERE id_item = ?';
    const result = await query(sql, [itemId]);
    return (result as any[])[0] || null;
  }

  static async findByOrcamentoId(
    orcamentoId: number
  ): Promise<OrcamentoItem[]> {
    const sql = 'SELECT * FROM orcamentos_itens WHERE id_orcamento = ? ORDER BY id_item ASC';
    const result = await query(sql, [orcamentoId]);
    return result as OrcamentoItem[];
  }

  static async update(
    itemId: number,
    data: UpdateOrcamentoItemDTO
  ): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      updates.push(`${key} = ?`);
      values.push(value ?? null);
    });

    values.push(itemId);

    const sql = `
      UPDATE orcamentos_itens
      SET ${updates.join(', ')}
      WHERE id_item = ?
    `;

    const result = await query(sql, values);
    return (result as any).affectedRows > 0;
  }

  static async delete(itemId: number): Promise<boolean> {
    const sql = 'DELETE FROM orcamentos_itens WHERE id_item = ?';
    const result = await query(sql, [itemId]);
    return (result as any).affectedRows > 0;
  }

  static async deleteByOrcamentoId(orcamentoId: number): Promise<boolean> {
    const sql = 'DELETE FROM orcamentos_itens WHERE id_orcamento = ?';
    const result = await query(sql, [orcamentoId]);
    return (result as any).affectedRows > 0;
  }
}
