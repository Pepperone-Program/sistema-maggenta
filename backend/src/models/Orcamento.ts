import { query } from '@database/connection';
import type { Orcamento, CreateOrcamentoDTO, UpdateOrcamentoDTO } from '@/types/orcamento';

export interface PendingOrcamentoEmail {
  id_empresa: number;
  id_orcamento: number;
}

export class OrcamentoModel {
  static async create(
    empresaId: number,
    data: CreateOrcamentoDTO
    ): Promise<any> {
    const optionalText = (value: unknown): string | null => {
      const text = String(value ?? '').trim();
      return text ? text : null;
    };
    const requiredText = (value: unknown): string => String(value ?? '').trim();
    const email = requiredText(data.email);
    const contato = optionalText(data.contato);
    const fantasia = optionalText(data.fantasia) || contato || email;

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
      fantasia,
      optionalText(data.endereco) || '',
      optionalText(data.endereco_n),
      optionalText(data.endereco_compl),
      optionalText(data.bairro),
      optionalText(data.cep),
      optionalText(data.cidade) || '',
      optionalText(data.uf) || '',
      optionalText(data.pais),
      optionalText(data.tel) || '',
      optionalText(data.tel2),
      optionalText(data.site),
      email,
      optionalText(data.obs),
      contato || '',
      optionalText(data.id_condicao),
      optionalText(data.id_vendedor),
      data.frete || 'E',
      optionalText(data.frete_valor),
      data.diluir_frete || 'N',
      optionalText(data.nivel) || '',
      optionalText(data.entrega) || '',
      optionalText(data.id_captacao),
      optionalText(data.logotipo),
      optionalText(data.layout),
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
    const allowedFields = new Set([
      'id_cliente',
      'data_orcamento',
      'fantasia',
      'endereco',
      'endereco_n',
      'endereco_compl',
      'bairro',
      'cep',
      'cidade',
      'uf',
      'pais',
      'tel',
      'tel2',
      'site',
      'email',
      'obs',
      'contato',
      'id_condicao',
      'id_vendedor',
      'frete',
      'frete_valor',
      'diluir_frete',
      'nivel',
      'entrega',
      'id_captacao',
      'logotipo',
      'layout',
      'layout_aprovado',
    ]);
    const updates: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (!allowedFields.has(key)) return;
      updates.push(`${key} = ?`);
      values.push(value ?? null);
    });

    if (!updates.length) {
      return false;
    }

    values.push(empresaId, orcamentoId);

    const sql = `
      UPDATE orcamentos
      SET ${updates.join(', ')}
      WHERE id_empresa = ? AND id_orcamento = ?
    `;

    const result = await query(sql, values);
    return (result as any).affectedRows > 0;
  }

  static async findPendingEmails(
    afterId: number,
    limit: number
  ): Promise<PendingOrcamentoEmail[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const sql = `
      SELECT o.id_empresa, o.id_orcamento
      FROM orcamentos o
      WHERE o.id_orcamento > ?
        AND (o.enviado IS NULL OR o.enviado = 'N')
        AND EXISTS (
          SELECT 1
          FROM orcamentos_itens oi
          WHERE oi.id_orcamento = o.id_orcamento
        )
      ORDER BY o.id_orcamento ASC
      LIMIT ?
    `;

    const result = await query(sql, [afterId, safeLimit]);
    return result as PendingOrcamentoEmail[];
  }

  static async delete(empresaId: number, orcamentoId: number): Promise<boolean> {
    const sql = 'DELETE FROM orcamentos WHERE id_empresa = ? AND id_orcamento = ?';
    const result = await query(sql, [empresaId, orcamentoId]);
    return (result as any).affectedRows > 0;
  }
}
