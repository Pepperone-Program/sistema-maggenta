import { query } from '@database/connection';
import type { Orcamento, CreateOrcamentoDTO, UpdateOrcamentoDTO } from '@/types/orcamento';

export class OrcamentoModel {
  static async create(
    empresaId: number,
    data: CreateOrcamentoDTO
    ): Promise<any> {
    const sql = `
      INSERT INTO orcamentos (
        id_empresa, data_orcamento, fantasia, endereco, endereco_n,
        endereco_compl, bairro, cep, cidade, uf, pais, tel, tel2,
        site, email, obs, contato, id_condicao, id_vendedor, frete,
        frete_valor, diluir_frete, nivel, entrega, id_captacao,
        logotipo, layout, layout_aprovado
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const values = [
      empresaId,
      data.data_orcamento || new Date(),
      data.fantasia,
      data.endereco,
      data.endereco_n || null,
      data.endereco_compl || null,
      data.bairro || null,
      data.cep || null,
      data.cidade,
      data.uf,
      data.pais || null,
      data.tel,
      data.tel2 || null,
      data.site || null,
      data.email,
      data.obs || null,
      data.contato,
      data.id_condicao || null,
      data.id_vendedor || null,
      data.frete || 'E',
      data.frete_valor || null,
      data.diluir_frete || 'N',
      data.nivel || '',
      data.entrega || '',
      data.id_captacao || null,
      data.logotipo || null,
      data.layout || null,
      data.layout_aprovado || 'N',
    ];

    const result = await query(sql, values);
    return (result as any).insertId;
  }

  static async findById(
    empresaId: number,
    orcamentoId: number
  ): Promise<Orcamento | null> {
    const sql = 'SELECT * FROM orcamentos WHERE id_empresa = ? AND id_orcamento = ?';
    const result = await query(sql, [empresaId, orcamentoId]);
    return (result as any[])[0] || null;
  }

  static async findAll(
    empresaId: number,
    page: number = 1,
    limit: number = 100,
    search?: string
  ): Promise<{ items: Orcamento[]; total: number }> {
    let sql = 'SELECT * FROM orcamentos WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (search) {
      sql += ` AND (fantasia LIKE ? OR email LIKE ? OR contato LIKE ?)`;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern);
    }

    const countResult = await query(
      sql.replace('SELECT *', 'SELECT COUNT(*) as total'),
      values
    );
    const total = (countResult as any[])[0].total;

    const offset = (page - 1) * limit;
    sql += ` ORDER BY data_orcamento DESC LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    const items = await query(sql, values);
    return { items: items as Orcamento[], total };
  }

  static async findByCliente(
    empresaId: number,
    clienteId: number,
    page: number = 1,
    limit: number = 100
  ): Promise<{ items: Orcamento[]; total: number }> {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const values = [empresaId, String(clienteId)];

    const countResult = await query(
      `
        SELECT COUNT(*) as total
        FROM orcamentos
        WHERE id_empresa = ? AND id_cliente = ?
      `,
      values
    );
    const total = (countResult as any[])[0].total;

    const items = await query(
      `
        SELECT *
        FROM orcamentos
        WHERE id_empresa = ? AND id_cliente = ?
        ORDER BY data_orcamento DESC, id_orcamento DESC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );

    return { items: items as Orcamento[], total };
  }

  static async update(
    empresaId: number,
    orcamentoId: number,
    data: UpdateOrcamentoDTO
  ): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      updates.push(`${key} = ?`);
      values.push(value ?? null);
    });

    values.push(empresaId, orcamentoId);

    const sql = `
      UPDATE orcamentos
      SET ${updates.join(', ')}
      WHERE id_empresa = ? AND id_orcamento = ?
    `;

    const result = await query(sql, values);
    return (result as any).affectedRows > 0;
  }

  static async delete(empresaId: number, orcamentoId: number): Promise<boolean> {
    const sql = 'DELETE FROM orcamentos WHERE id_empresa = ? AND id_orcamento = ?';
    const result = await query(sql, [empresaId, orcamentoId]);
    return (result as any).affectedRows > 0;
  }
}
