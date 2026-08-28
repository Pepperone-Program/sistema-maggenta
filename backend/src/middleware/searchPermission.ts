import type { NextFunction, Response } from 'express';
import { query } from '@database/connection';
import type { AuthenticatedRequest } from './auth';
import { errorResponse } from '@utils/response';

export const requireSearchPermission = (permission: 'search.manage' | 'search.debug') =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        errorResponse(res, 'NO_TOKEN', 'Token not provided', 401);
        return;
      }
      const rows = (await query(
        `SELECT 1
         FROM aux_grupos_usuarios gu
         LEFT JOIN aux_grupos_permissoes gp
           ON gp.id_empresa = gu.id_empresa AND gp.grupo = gu.grupo
         WHERE gu.id_empresa = ? AND gu.id_usuario = ?
           AND (LOWER(gu.grupo) IN ('administrador','admin') OR gp.permissao = ?)
         LIMIT 1`,
        [req.user.id_empresa, req.user.id_usuario, permission]
      )) as unknown[];
      if (!rows.length) {
        errorResponse(res, 'FORBIDDEN', `Permissao ${permission} obrigatoria`, 403);
        return;
      }
      next();
    } catch (error) {
      const err = error as { code?: string; message?: string; statusCode?: number };
      errorResponse(res, err.code || 'PERMISSION_CHECK_FAILED', err.message || 'Falha ao verificar permissao', err.statusCode || 500);
    }
  };
