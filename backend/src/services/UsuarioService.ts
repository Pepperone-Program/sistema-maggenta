import { UsuarioModel } from '@models/Usuario';
import type { Usuario, CreateUsuarioDTO, UpdateUsuarioDTO, LoginDTO, AuthPayload } from '@/types/usuario';
import { generateToken, throwError } from '@utils/helpers';

export class UsuarioService {
  static async register(
    empresaId: number,
    data: CreateUsuarioDTO
  ): Promise<Omit<Usuario, 'senha'>> {
    const existente = await UsuarioModel.findByUsername(empresaId, data.usuario);
    if (existente) {
      throwError('DUPLICATE_USER', 'Usuário já existe', 409);
    }

    const emailExistente = await UsuarioModel.findByEmail(empresaId, data.email);
    if (emailExistente) {
      throwError('DUPLICATE_EMAIL', 'Email já está registrado', 409);
    }

    const usuarioId = await UsuarioModel.create(empresaId, data);
    const usuario = await UsuarioModel.findById(empresaId, usuarioId);

    if (!usuario) {
      throwError('CREATE_FAILED', 'Falha ao criar usuário', 500);
    }

    const usuarioSeguro = usuario as Usuario;
    const { senha, ...rest } = usuarioSeguro;
    return rest;
  }

  static async login(
    empresaId: number,
    credentials: LoginDTO
  ): Promise<{ usuario: Omit<Usuario, 'senha'>; token: string }> {
    const usuario = await UsuarioModel.findActiveByUsername(
      empresaId,
      credentials.usuario
    );

    if (!usuario) {
      throwError('INVALID_CREDENTIALS', 'Usuário ou senha inválidos', 401);
    }

    const usuarioSeguro = usuario as Usuario;

    const passwordValidation = await UsuarioModel.validatePassword(
      usuarioSeguro,
      credentials.senha
    );

    if (!passwordValidation.valid) {
      throwError('INVALID_CREDENTIALS', 'Usuário ou senha inválidos', 401);
    }

    if (passwordValidation.needsRehash) {
      await UsuarioModel.updatePasswordHash(
        empresaId,
        usuarioSeguro.id_usuario,
        credentials.senha
      );
    }

    await UsuarioModel.updateLastLogin(usuarioSeguro.id_usuario);

    const payload: AuthPayload = {
      id_usuario: usuarioSeguro.id_usuario,
      id_empresa: usuarioSeguro.id_empresa,
      usuario: usuarioSeguro.usuario,
      email: usuarioSeguro.email,
    };

    const token = generateToken(payload);
    const { senha, ...rest } = usuarioSeguro;

    return { usuario: rest, token };
  }

  static async getUsuarioById(
    empresaId: number,
    usuarioId: number
  ): Promise<Omit<Usuario, 'senha'>> {
    const usuario = await UsuarioModel.findById(empresaId, usuarioId);

    if (!usuario) {
      throwError('USUARIO_NOT_FOUND', 'Usuário não encontrado', 404);
    }

    const usuarioSeguro = usuario as Usuario;
    const { senha, ...rest } = usuarioSeguro;
    return rest;
  }

  static async listUsuarios(
    empresaId: number,
    page: number = 1,
    limit: number = 100,
    search?: string
  ): Promise<{ items: Omit<Usuario, 'senha'>[]; total: number; page: number; limit: number }> {
    const { items, total } = await UsuarioModel.findAll(
      empresaId,
      page,
      limit,
      search
    );

    return {
      items,
      total,
      page,
      limit,
    };
  }

  static async updateUsuario(
    empresaId: number,
    usuarioId: number,
    data: UpdateUsuarioDTO
  ): Promise<Omit<Usuario, 'senha'>> {
    const usuario = await UsuarioModel.findById(empresaId, usuarioId);

    if (!usuario) {
      throwError('USUARIO_NOT_FOUND', 'Usuário não encontrado', 404);
    }

    const usuarioSeguro = usuario as Usuario;

    if (data.email && data.email !== usuarioSeguro.email) {
      const emailExistente = await UsuarioModel.findByEmail(
        empresaId,
        data.email
      );
      if (emailExistente) {
        throwError('DUPLICATE_EMAIL', 'Email já está registrado', 409);
      }
    }

    await UsuarioModel.update(empresaId, usuarioId, data);
    const updated = await UsuarioModel.findById(empresaId, usuarioId);

    if (!updated) {
      throwError('UPDATE_FAILED', 'Falha ao atualizar usuário', 500);
    }

    const updatedSeguro = updated as Usuario;
    const { senha, ...rest } = updatedSeguro;
    return rest;
  }

  static async deleteUsuario(
    empresaId: number,
    usuarioId: number
  ): Promise<void> {
    const usuario = await UsuarioModel.findById(empresaId, usuarioId);

    if (!usuario) {
      throwError('USUARIO_NOT_FOUND', 'Usuário não encontrado', 404);
    }

    const success = await UsuarioModel.delete(empresaId, usuarioId);

    if (!success) {
      throwError('DELETE_FAILED', 'Falha ao deletar usuário', 500);
    }
  }
}
