import { query } from '@database/connection';
import type {
  Cliente,
  ClienteContato,
  CreateClienteContatoDTO,
  CreateClienteDTO,
  UpdateClienteContatoDTO,
  UpdateClienteDTO,
} from '@/types/cliente';

const normalizeLimit = (limit: number): number => Math.min(Math.max(limit, 1), 100);
const normalizePage = (page: number): number => Math.max(page, 1);

export class ClienteModel {
  static async create(empresaId: number, data: CreateClienteDTO): Promise<number> {
    const columns = [
      'id_empresa',
      'pessoa',
      'cnpj_cpf',
      'ie_rg',
      'razao_social',
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
      'tel3',
      'fax',
      'site',
      'email',
      'logotipo',
      'obs',
      'consumidor_final',
      'cadastro_site',
      'id_transportadora',
      'id_vendedor',
      'id_captacao',
      'habilitado',
      'data_inclusao',
      'ultima_venda',
    ];
    const placeholders = columns.map(() => '?');
    const values: any[] = [
      empresaId,
      data.pessoa || 'J',
      data.cnpj_cpf || null,
      data.ie_rg || null,
      data.razao_social || null,
      data.fantasia,
      data.endereco || null,
      data.endereco_n || null,
      data.endereco_compl || null,
      data.bairro || null,
      data.cep || null,
      data.cidade || null,
      data.uf || null,
      data.pais || 'BRASIL',
      data.tel || null,
      data.tel2 || null,
      data.tel3 || null,
      data.fax || null,
      data.site || null,
      data.email || null,
      data.logotipo || null,
      data.obs || null,
      data.consumidor_final || null,
      data.cadastro_site || null,
      data.id_transportadora || null,
      data.id_vendedor || null,
      data.id_captacao || null,
      data.habilitado || 'S',
      new Date(),
      data.ultima_venda || null,
    ];

    if (data.id_cliente !== undefined) {
      columns.splice(1, 0, 'id_cliente');
      placeholders.splice(1, 0, '?');
      values.splice(1, 0, data.id_cliente);
    }

    const sql = `
      INSERT INTO clientes (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;
    const result = await query(sql, values);
    return data.id_cliente ?? (result as any).insertId;
  }

  static async findById(empresaId: number, clienteId: number): Promise<Cliente | null> {
    const sql = 'SELECT * FROM clientes WHERE id_empresa = ? AND id_cliente = ? LIMIT 1';
    const result = await query(sql, [empresaId, clienteId]);
    return (result as Cliente[])[0] || null;
  }

  static async findByDocumento(
    empresaId: number,
    cnpjCpf: string
  ): Promise<Cliente | null> {
    const sql = `
      SELECT *
      FROM clientes
      WHERE id_empresa = ? AND cnpj_cpf = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, cnpjCpf]);
    return (result as Cliente[])[0] || null;
  }

  static async findAll(
    empresaId: number,
    page: number = 1,
    limit: number = 100,
    search?: string,
    habilitado?: string
  ): Promise<{ items: Cliente[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    let where = 'WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (search) {
      where += `
        AND (
          fantasia LIKE ? OR razao_social LIKE ? OR cnpj_cpf LIKE ?
          OR email LIKE ? OR cidade LIKE ?
        )
      `;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (habilitado) {
      where += ' AND habilitado = ?';
      values.push(habilitado);
    }

    const countResult = await query(`SELECT COUNT(*) as total FROM clientes ${where}`, values);
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT *
        FROM clientes
        ${where}
        ORDER BY fantasia ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );
    return { items: items as Cliente[], total };
  }

  static async update(
    empresaId: number,
    clienteId: number,
    data: UpdateClienteDTO
  ): Promise<boolean> {
    const allowedColumns = [
      'pessoa',
      'cnpj_cpf',
      'ie_rg',
      'razao_social',
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
      'tel3',
      'fax',
      'site',
      'email',
      'logotipo',
      'obs',
      'consumidor_final',
      'cadastro_site',
      'id_transportadora',
      'id_vendedor',
      'id_captacao',
      'habilitado',
      'ultima_venda',
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
      UPDATE clientes
      SET ${updates.join(', ')}
      WHERE id_empresa = ? AND id_cliente = ?
    `;
    const result = await query(sql, [...values, empresaId, clienteId]);
    return (result as any).affectedRows > 0;
  }

  static async delete(empresaId: number, clienteId: number): Promise<boolean> {
    const sql = 'DELETE FROM clientes WHERE id_empresa = ? AND id_cliente = ?';
    const result = await query(sql, [empresaId, clienteId]);
    return (result as any).affectedRows > 0;
  }
}

export class ClienteContatoModel {
  static async create(
    empresaId: number,
    clienteId: number,
    data: CreateClienteContatoDTO
  ): Promise<ClienteContato> {
    const sql = `
      INSERT INTO clientes_contatos (
        id_empresa, id_cliente, contato_email, contato_nome, contato_depto,
        contato_cargo, contato_tel, contato_celular, contato_nascimento,
        contato_obs, habilitado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      empresaId,
      clienteId,
      data.contato_email,
      data.contato_nome || null,
      data.contato_depto || null,
      data.contato_cargo || null,
      data.contato_tel || null,
      data.contato_celular || null,
      data.contato_nascimento || null,
      data.contato_obs || null,
      data.habilitado || 'S',
    ];
    await query(sql, values);
    return (await this.findByEmail(empresaId, clienteId, data.contato_email)) as ClienteContato;
  }

  static async findByEmail(
    empresaId: number,
    clienteId: number,
    contatoEmail: string
  ): Promise<ClienteContato | null> {
    const sql = `
      SELECT *
      FROM clientes_contatos
      WHERE id_empresa = ? AND id_cliente = ? AND contato_email = ?
      LIMIT 1
    `;
    const result = await query(sql, [empresaId, clienteId, contatoEmail]);
    return (result as ClienteContato[])[0] || null;
  }

  static async findAll(
    empresaId: number,
    clienteId: number,
    page: number = 1,
    limit: number = 100,
    search?: string,
    habilitado?: string
  ): Promise<{ items: ClienteContato[]; total: number }> {
    const safePage = normalizePage(page);
    const safeLimit = normalizeLimit(limit);
    let where = 'WHERE id_empresa = ? AND id_cliente = ?';
    const values: any[] = [empresaId, clienteId];

    if (search) {
      where += ' AND (contato_nome LIKE ? OR contato_email LIKE ? OR contato_cargo LIKE ?)';
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern);
    }

    if (habilitado) {
      where += ' AND habilitado = ?';
      values.push(habilitado);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM clientes_contatos ${where}`,
      values
    );
    const total = (countResult as any[])[0].total;
    const items = await query(
      `
        SELECT *
        FROM clientes_contatos
        ${where}
        ORDER BY contato_nome ASC, contato_email ASC
        LIMIT ? OFFSET ?
      `,
      [...values, safeLimit, (safePage - 1) * safeLimit]
    );
    return { items: items as ClienteContato[], total };
  }

  static async update(
    empresaId: number,
    clienteId: number,
    contatoEmail: string,
    data: UpdateClienteContatoDTO
  ): Promise<boolean> {
    const allowedColumns = [
      'contato_email',
      'contato_nome',
      'contato_depto',
      'contato_cargo',
      'contato_tel',
      'contato_celular',
      'contato_nascimento',
      'contato_obs',
      'habilitado',
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
      UPDATE clientes_contatos
      SET ${updates.join(', ')}
      WHERE id_empresa = ? AND id_cliente = ? AND contato_email = ?
    `;
    const result = await query(sql, [...values, empresaId, clienteId, contatoEmail]);
    return (result as any).affectedRows > 0;
  }

  static async delete(
    empresaId: number,
    clienteId: number,
    contatoEmail: string
  ): Promise<boolean> {
    const sql = `
      DELETE FROM clientes_contatos
      WHERE id_empresa = ? AND id_cliente = ? AND contato_email = ?
    `;
    const result = await query(sql, [empresaId, clienteId, contatoEmail]);
    return (result as any).affectedRows > 0;
  }

  static async deleteByCliente(empresaId: number, clienteId: number): Promise<void> {
    const sql = 'DELETE FROM clientes_contatos WHERE id_empresa = ? AND id_cliente = ?';
    await query(sql, [empresaId, clienteId]);
  }
}
