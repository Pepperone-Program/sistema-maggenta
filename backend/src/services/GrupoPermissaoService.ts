import { GrupoPermissaoModel } from '@models/GrupoPermissao';
import type {
  CreateGrupoPermissaoDTO,
  CreateGrupoUsuarioDTO,
  Grupo,
  GrupoPermissao,
  GrupoUsuario,
} from '@/types/grupo-permissao';
import { throwError } from '@utils/helpers';

const normalizeGrupo = (grupo: string): string => grupo.trim().toLowerCase();
const normalizePermissao = (permissao: string): string => permissao.trim().toLowerCase();

export class GrupoPermissaoService {
  static async listGrupos(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<{ items: Grupo[]; total: number; page: number; limit: number }> {
    const { items, total } = await GrupoPermissaoModel.findGrupos(
      empresaId,
      page,
      limit,
      search
    );

    return { items, total, page, limit };
  }

  static async listPermissoes(
    empresaId: number,
    grupo: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: GrupoPermissao[]; total: number; page: number; limit: number }> {
    const { items, total } = await GrupoPermissaoModel.findPermissoes(
      empresaId,
      normalizeGrupo(grupo),
      page,
      limit
    );

    return { items, total, page, limit };
  }

  static async listUsuariosComGrupos(
    empresaId: number,
    page: number = 1,
    limit: number = 50,
    search?: string
  ) {
    const [{ items, total }, permissoes] = await Promise.all([
      GrupoPermissaoModel.findUsuariosComGrupo(empresaId, page, limit, search),
      GrupoPermissaoModel.findPermissaoOptions(empresaId),
    ]);

    return {
      items,
      permissoes,
      total,
      page,
      limit,
    };
  }

  static async addPermissao(
    empresaId: number,
    grupo: string,
    data: CreateGrupoPermissaoDTO
  ): Promise<GrupoPermissao> {
    const normalizedGrupo = normalizeGrupo(grupo);
    const normalizedPermissao = normalizePermissao(data.permissao);
    const existente = await GrupoPermissaoModel.findPermissao(
      empresaId,
      normalizedGrupo,
      normalizedPermissao
    );

    if (existente) {
      return existente;
    }

    return GrupoPermissaoModel.addPermissao(
      empresaId,
      normalizedGrupo,
      normalizedPermissao
    );
  }

  static async removePermissao(
    empresaId: number,
    grupo: string,
    permissao: string
  ): Promise<void> {
    const success = await GrupoPermissaoModel.removePermissao(
      empresaId,
      normalizeGrupo(grupo),
      normalizePermissao(permissao)
    );

    if (!success) {
      throwError('PERMISSAO_NOT_FOUND', 'Permissao nao encontrada para o grupo', 404);
    }
  }

  static async listUsuarios(
    empresaId: number,
    grupo: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: GrupoUsuario[]; total: number; page: number; limit: number }> {
    const { items, total } = await GrupoPermissaoModel.findUsuarios(
      empresaId,
      normalizeGrupo(grupo),
      page,
      limit
    );

    return { items, total, page, limit };
  }

  static async addUsuario(
    empresaId: number,
    grupo: string,
    data: CreateGrupoUsuarioDTO
  ): Promise<GrupoUsuario> {
    const normalizedGrupo = normalizeGrupo(grupo);

    if (!(await GrupoPermissaoModel.usuarioExists(empresaId, data.id_usuario))) {
      throwError('USUARIO_NOT_FOUND', 'Usuario nao encontrado', 404);
    }

    const existente = await GrupoPermissaoModel.findUsuarioGrupo(
      empresaId,
      normalizedGrupo,
      data.id_usuario
    );

    if (existente) {
      return existente;
    }

    return GrupoPermissaoModel.addUsuario(empresaId, normalizedGrupo, data.id_usuario);
  }

  static async removeUsuario(
    empresaId: number,
    grupo: string,
    usuarioId: number
  ): Promise<void> {
    const success = await GrupoPermissaoModel.removeUsuario(
      empresaId,
      normalizeGrupo(grupo),
      usuarioId
    );

    if (!success) {
      throwError('USUARIO_GRUPO_NOT_FOUND', 'Usuario nao vinculado ao grupo', 404);
    }
  }

  static async setUsuarioGrupo(
    empresaId: number,
    usuarioId: number,
    grupo: string
  ): Promise<GrupoUsuario> {
    const normalizedGrupo = normalizeGrupo(grupo);

    if (!(await GrupoPermissaoModel.usuarioExists(empresaId, usuarioId))) {
      throwError('USUARIO_NOT_FOUND', 'Usuario nao encontrado', 404);
    }

    const opcoes = await GrupoPermissaoModel.findPermissaoOptions(empresaId);
    const grupoExiste = opcoes.some((item) => item.grupo === normalizedGrupo);
    if (!grupoExiste) {
      throwError('GRUPO_NOT_FOUND', 'Grupo nao encontrado em permissoes', 404);
    }

    return GrupoPermissaoModel.setUsuarioGrupo(empresaId, usuarioId, normalizedGrupo);
  }

  static async listGruposByUsuario(
    empresaId: number,
    usuarioId: number
  ): Promise<GrupoUsuario[]> {
    if (!(await GrupoPermissaoModel.usuarioExists(empresaId, usuarioId))) {
      throwError('USUARIO_NOT_FOUND', 'Usuario nao encontrado', 404);
    }

    return GrupoPermissaoModel.findGruposByUsuario(empresaId, usuarioId);
  }

  static async listPermissoesByUsuario(
    empresaId: number,
    usuarioId: number
  ): Promise<GrupoPermissao[]> {
    if (!(await GrupoPermissaoModel.usuarioExists(empresaId, usuarioId))) {
      throwError('USUARIO_NOT_FOUND', 'Usuario nao encontrado', 404);
    }

    return GrupoPermissaoModel.findPermissoesByUsuario(empresaId, usuarioId);
  }
}
