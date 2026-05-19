import { query } from '@database/connection';
import { comparePassword, oldPasswordHash } from '@utils/password';
import type {
  Usuario,
  CreateUsuarioDTO,
  UpdateUsuarioDTO,
} from '@/types/usuario';

export class UsuarioModel {
  static async create(
    empresaId: number,
    data: CreateUsuarioDTO
  ): Promise<number> {
    const hashedPassword = oldPasswordHash(data.senha);

    const sql = `
      INSERT INTO usuarios (
        id_empresa, usuario, nome, email, senha, ramal, tel, cel,
        endereco, endereco_n, endereco_compl, bairro, cep, cidade, uf,
        comissao, data_inicial, data_final, habilitado
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?,
        ?
      )
    `;

    const values = [
      empresaId,
      data.usuario.trim().toLowerCase(),
      data.nome,
      data.email,
      hashedPassword,
      data.ramal || null,
      data.tel || null,
      data.cel || null,
      data.endereco || null,
      data.endereco_n || null,
      data.endereco_compl || null,
      data.bairro || null,
      data.cep || null,
      data.cidade || null,
      data.uf || null,
      data.comissao || '0.00',
      data.data_final || '2030-12-31',
      data.habilitado || 'S',
    ];

    const result = await query(sql, values);
    return (result as any).insertId;
  }

  static async findById(
    empresaId: number,
    usuarioId: number
  ): Promise<Usuario | null> {
    const sql = 'SELECT * FROM usuarios WHERE id_empresa = ? AND id_usuario = ?';
    const result = await query(sql, [empresaId, usuarioId]);
    return (result as any[])[0] || null;
  }

  static async findByUsername(
    empresaId: number,
    usuario: string
  ): Promise<Usuario | null> {
    const sql = 'SELECT * FROM usuarios WHERE id_empresa = ? AND LOWER(usuario) = ?';
    const result = await query(sql, [empresaId, usuario.trim().toLowerCase()]);
    return (result as any[])[0] || null;
  }

  static async findActiveByUsername(
    empresaId: number,
    usuario: string
  ): Promise<Usuario | null> {
    const sql = `
      SELECT *
      FROM usuarios
      WHERE id_empresa = ?
        AND LOWER(usuario) = ?
        AND habilitado = 'S'
        AND data_inicial <= NOW()
        AND data_final >= NOW()
    `;
    const result = await query(sql, [empresaId, usuario.trim().toLowerCase()]);
    return (result as any[])[0] || null;
  }

  static async findByEmail(
    empresaId: number,
    email: string
  ): Promise<Usuario | null> {
    const sql = 'SELECT * FROM usuarios WHERE id_empresa = ? AND email = ?';
    const result = await query(sql, [empresaId, email]);
    return (result as any[])[0] || null;
  }

  static async findAll(
    empresaId: number,
    page: number = 1,
    limit: number = 100,
    search?: string
  ): Promise<{ items: Omit<Usuario, 'senha'>[]; total: number }> {
    let sql = 'SELECT * FROM usuarios WHERE id_empresa = ?';
    const values: any[] = [empresaId];

    if (search) {
      sql += ` AND (nome LIKE ? OR usuario LIKE ? OR email LIKE ?)`;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern);
    }

    const countResult = await query(
      sql.replace('SELECT *', 'SELECT COUNT(*) as total'),
      values
    );
    const total = (countResult as any[])[0].total;

    const offset = (page - 1) * limit;
    sql += ` ORDER BY nome ASC LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    const result = await query(sql, values);
    const items = (result as Usuario[]).map(({ senha, ...rest }) => rest);

    return { items, total };
  }

  static async validatePassword(
    usuario: Usuario,
    senha: string
  ): Promise<{ valid: boolean; needsRehash: boolean }> {
    const valid = await comparePassword(senha, usuario.senha);
    return {
      valid,
      needsRehash: false,
    };
  }

  static async updatePasswordHash(
    empresaId: number,
    usuarioId: number,
    senha: string
  ): Promise<boolean> {
    const hashedPassword = oldPasswordHash(senha);
    const sql = `
      UPDATE usuarios
      SET senha = ?
      WHERE id_empresa = ? AND id_usuario = ?
    `;
    const result = await query(sql, [hashedPassword, empresaId, usuarioId]);
    return (result as any).affectedRows > 0;
  }

  static async update(
    empresaId: number,
    usuarioId: number,
    data: UpdateUsuarioDTO
  ): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key === 'senha' && value) {
        const hashedPassword = oldPasswordHash(value as string);
        updates.push(`${key} = ?`);
        values.push(hashedPassword);
      } else if (value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value ?? null);
      }
    }

    if (updates.length === 0) return true;

    values.push(empresaId, usuarioId);

    const sql = `
      UPDATE usuarios
      SET ${updates.join(', ')}
      WHERE id_empresa = ? AND id_usuario = ?
    `;

    const result = await query(sql, values);
    return (result as any).affectedRows > 0;
  }

  static async delete(empresaId: number, usuarioId: number): Promise<boolean> {
    const sql = 'DELETE FROM usuarios WHERE id_empresa = ? AND id_usuario = ?';
    const result = await query(sql, [empresaId, usuarioId]);
    return (result as any).affectedRows > 0;
  }

  static async updateLastLogin(usuarioId: number): Promise<boolean> {
    const sql = 'UPDATE usuarios SET last_login = NOW() WHERE id_usuario = ?';
    const result = await query(sql, [usuarioId]);
    return (result as any).affectedRows > 0;
  }
}
