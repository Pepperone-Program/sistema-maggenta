import { getConnection, query } from '@database/connection';
import type { Orcamento, CreateOrcamentoDTO, UpdateOrcamentoDTO } from '@/types/orcamento';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export interface PendingOrcamentoEmail {
  id_empresa: number;
  id_orcamento: number;
}

export class OrcamentoModel {
  private static idempotencyTableReady: Promise<void> | null = null;
  private static readonly fallbackCreations = new Map<string, Promise<{ id: number; created: boolean }>>();

  private static ensureIdempotencyTable(): Promise<void> {
    if (!this.idempotencyTableReady) {
      this.idempotencyTableReady = query(`
        CREATE TABLE IF NOT EXISTS orcamentos_idempotencia (
          fingerprint CHAR(64) NOT NULL PRIMARY KEY,
          id_empresa INT NOT NULL,
          id_orcamento INT NOT NULL,
          expira_em DATETIME NOT NULL,
          criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_orcamentos_idempotencia_expira (expira_em),
          INDEX idx_orcamentos_idempotencia_orcamento (id_empresa, id_orcamento)
        ) ENGINE=InnoDB
      `).then(() => undefined).catch((error) => {
        this.idempotencyTableReady = null;
        throw error;
      });
    }
    return this.idempotencyTableReady;
  }

  static async ensureIdempotencyInfrastructure(): Promise<void> {
    await this.ensureIdempotencyTable();
    await query('SELECT fingerprint FROM orcamentos_idempotencia LIMIT 1');
  }

  private static insertValues(empresaId: number, data: CreateOrcamentoDTO): any[] {
    const optionalText = (value: unknown): string | null => {
      const text = String(value ?? '').trim();
      return text ? text : null;
    };
    const requiredText = (value: unknown): string => String(value ?? '').trim();
    const email = requiredText(data.email);
    const contato = optionalText(data.contato);
    const fantasia = optionalText(data.fantasia) || contato || email;

    return [
      empresaId, data.data_orcamento || new Date(), fantasia,
      optionalText(data.endereco) || '', optionalText(data.endereco_n),
      optionalText(data.endereco_compl), optionalText(data.bairro), optionalText(data.cep),
      optionalText(data.cidade) || '', optionalText(data.uf) || '', optionalText(data.pais),
      optionalText(data.tel) || '', optionalText(data.tel2), optionalText(data.site), email,
      optionalText(data.obs), contato || '', optionalText(data.id_condicao),
      optionalText(data.id_vendedor), data.frete || 'E', optionalText(data.frete_valor),
      data.diluir_frete || 'N', optionalText(data.nivel) || '', optionalText(data.entrega) || '',
      optionalText(data.id_captacao), optionalText(data.logotipo), optionalText(data.layout),
      data.layout_aprovado || 'N',
    ];
  }

  private static async insert(connection: PoolConnection, empresaId: number, data: CreateOrcamentoDTO): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO orcamentos (
        id_empresa, data_orcamento, fantasia, endereco, endereco_n,
        endereco_compl, bairro, cep, cidade, uf, pais, tel, tel2,
        site, email, obs, contato, id_condicao, id_vendedor, frete,
        frete_valor, diluir_frete, nivel, entrega, id_captacao,
        logotipo, layout, layout_aprovado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, this.insertValues(empresaId, data));
    return result.insertId;
  }

  static async createIdempotent(
    empresaId: number,
    data: CreateOrcamentoDTO,
    fingerprint: string,
    ttlSeconds: number
  ): Promise<{ id: number; created: boolean }> {
    await this.ensureIdempotencyTable();
    const connection = await getConnection();
    const lockName = `orcamento:${fingerprint.slice(0, 48)}`;
    let locked = false;

    try {
      const [lockRows] = await connection.execute<RowDataPacket[]>('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
      locked = Number(lockRows[0]?.acquired) === 1;
      if (!locked) throw new Error('Nao foi possivel obter a trava de idempotencia do orcamento');

      const [existingRows] = await connection.execute<RowDataPacket[]>(`
        SELECT i.id_orcamento FROM orcamentos_idempotencia i
        INNER JOIN orcamentos o
          ON o.id_empresa = i.id_empresa AND o.id_orcamento = i.id_orcamento
        WHERE i.fingerprint = ? AND i.expira_em > NOW()
        LIMIT 1
      `, [fingerprint]);
      const existingId = Number(existingRows[0]?.id_orcamento);
      if (Number.isInteger(existingId) && existingId > 0) {
        return { id: existingId, created: false };
      }

      await connection.beginTransaction();
      const id = await this.insert(connection, empresaId, data);
      await connection.execute(`
        INSERT INTO orcamentos_idempotencia (fingerprint, id_empresa, id_orcamento, expira_em)
        VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
        ON DUPLICATE KEY UPDATE id_empresa = VALUES(id_empresa), id_orcamento = VALUES(id_orcamento),
          expira_em = VALUES(expira_em), criado_em = CURRENT_TIMESTAMP
      `, [fingerprint, empresaId, id, ttlSeconds]);
      await connection.commit();
      return { id, created: true };
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      if (locked) await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
      connection.release();
    }
  }

  static createWithLocalFallback(
    empresaId: number,
    data: CreateOrcamentoDTO,
    fingerprint: string
  ): Promise<{ id: number; created: boolean }> {
    const current = this.fallbackCreations.get(fingerprint);
    if (current) return current.then((result) => ({ ...result, created: false }));

    const creation = (async () => {
      try {
        const result = await query(`
          INSERT INTO orcamentos (
            id_empresa, data_orcamento, fantasia, endereco, endereco_n,
            endereco_compl, bairro, cep, cidade, uf, pais, tel, tel2,
            site, email, obs, contato, id_condicao, id_vendedor, frete,
            frete_valor, diluir_frete, nivel, entrega, id_captacao,
            logotipo, layout, layout_aprovado
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, this.insertValues(empresaId, data));
        setTimeout(() => this.fallbackCreations.delete(fingerprint), 120000).unref?.();
        return { id: Number((result as ResultSetHeader).insertId), created: true };
      } catch (error) {
        this.fallbackCreations.delete(fingerprint);
        throw error;
      }
    })();

    this.fallbackCreations.set(fingerprint, creation);
    return creation;
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
    search?: string,
    date?: string
  ): Promise<{ items: Orcamento[]; total: number }> {
    let sql = 'SELECT * FROM orcamentos WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (search) {
      const numericSearch = Number(search);
      sql += ` AND (fantasia LIKE ? OR email LIKE ? OR contato LIKE ?${Number.isInteger(numericSearch) ? ' OR id_orcamento = ?' : ''})`;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern);
      if (Number.isInteger(numericSearch)) values.push(numericSearch);
    }
    if (date) {
      sql += ' AND DATE(data_orcamento) = ?';
      values.push(date);
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
