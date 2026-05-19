import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { UsuarioService } from '@services/UsuarioService';
import { successResponse, paginatedResponse, errorResponse } from '@utils/response';

export class UsuarioController {
  static async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const usuario = await UsuarioService.register(empresaId, req.body);

      successResponse(res, usuario, 'Usuário criado com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = Number(req.body.id_empresa || req.user?.id_empresa || 1);
      const { usuario, token } = await UsuarioService.login(
        empresaId,
        req.body
      );

      successResponse(res, { usuario, token }, 'Login bem-sucedido', 200);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'NO_USER', 'Usuário não autenticado', 401);
        return;
      }

      const empresaId = req.user.id_empresa;
      const usuarioId = req.user.id_usuario;
      const usuario = await UsuarioService.getUsuarioById(empresaId, usuarioId);

      successResponse(res, usuario);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const usuario = await UsuarioService.getUsuarioById(
        empresaId,
        parseInt(id, 10)
      );

      successResponse(res, usuario);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '100', 10);
      const search = req.query.search as string | undefined;

      const result = await UsuarioService.listUsuarios(
        empresaId,
        page,
        limit,
        search
      );

      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Usuários listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const usuario = await UsuarioService.updateUsuario(
        empresaId,
        parseInt(id, 10),
        req.body
      );

      successResponse(res, usuario, 'Usuário atualizado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      await UsuarioService.deleteUsuario(
        empresaId,
        parseInt(id, 10)
      );

      successResponse(res, null, 'Usuário deletado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
