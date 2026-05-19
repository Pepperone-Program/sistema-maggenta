import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { GrupoPermissaoService } from '@services/GrupoPermissaoService';
import { errorResponse, paginatedResponse, successResponse } from '@utils/response';

const getEmpresaId = (req: AuthenticatedRequest): number => req.user?.id_empresa || 1;
const getPage = (req: AuthenticatedRequest): number =>
  parseInt((req.query.page as string) || '1', 10);
const getLimit = (req: AuthenticatedRequest): number =>
  parseInt((req.query.limit as string) || '100', 10);

export class GrupoPermissaoController {
  static async listGrupos(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await GrupoPermissaoService.listGrupos(
        getEmpresaId(req),
        getPage(req),
        getLimit(req),
        req.query.search as string | undefined
      );

      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Grupos listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listPermissoes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await GrupoPermissaoService.listPermissoes(
        getEmpresaId(req),
        req.params.grupo,
        getPage(req),
        getLimit(req)
      );

      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Permissoes do grupo listadas com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listUsuariosComGrupos(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await GrupoPermissaoService.listUsuariosComGrupos(
        getEmpresaId(req),
        getPage(req),
        getLimit(req),
        req.query.search as string | undefined
      );

      successResponse(res, result, 'Usuarios e permissoes listados com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async addPermissao(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const permissao = await GrupoPermissaoService.addPermissao(
        getEmpresaId(req),
        req.params.grupo,
        req.body
      );

      successResponse(res, permissao, 'Permissao vinculada ao grupo com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async removePermissao(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await GrupoPermissaoService.removePermissao(
        getEmpresaId(req),
        req.params.grupo,
        req.params.permissao
      );

      successResponse(res, null, 'Permissao removida do grupo com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listUsuarios(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await GrupoPermissaoService.listUsuarios(
        getEmpresaId(req),
        req.params.grupo,
        getPage(req),
        getLimit(req)
      );

      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Usuarios do grupo listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async addUsuario(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const usuarioGrupo = await GrupoPermissaoService.addUsuario(
        getEmpresaId(req),
        req.params.grupo,
        req.body
      );

      successResponse(res, usuarioGrupo, 'Usuario vinculado ao grupo com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async removeUsuario(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await GrupoPermissaoService.removeUsuario(
        getEmpresaId(req),
        req.params.grupo,
        parseInt(req.params.usuarioId, 10)
      );

      successResponse(res, null, 'Usuario removido do grupo com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async setUsuarioGrupo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const usuarioGrupo = await GrupoPermissaoService.setUsuarioGrupo(
        getEmpresaId(req),
        parseInt(req.params.usuarioId, 10),
        req.body?.grupo
      );

      successResponse(res, usuarioGrupo, 'Grupo do usuario atualizado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listGruposByUsuario(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const grupos = await GrupoPermissaoService.listGruposByUsuario(
        getEmpresaId(req),
        parseInt(req.params.usuarioId, 10)
      );

      successResponse(res, grupos, 'Grupos do usuario listados com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listPermissoesByUsuario(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const permissoes = await GrupoPermissaoService.listPermissoesByUsuario(
        getEmpresaId(req),
        parseInt(req.params.usuarioId, 10)
      );

      successResponse(res, permissoes, 'Permissoes do usuario listadas com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
