import { Request, Response } from 'express';
import { generateNonExpiringToken, throwError } from '@utils/helpers';
import { errorResponse, successResponse } from '@utils/response';

export class SiteTokenController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const configuredSecret = process.env.SITE_TOKEN_SECRET;
      const providedSecret =
        req.headers['x-site-token-secret'] ||
        req.body?.secret ||
        req.query.secret;

      if (!configuredSecret) {
        throwError(
          'SITE_TOKEN_SECRET_NOT_CONFIGURED',
          'Configure SITE_TOKEN_SECRET para gerar o token do site',
          500
        );
      }

      if (providedSecret !== configuredSecret) {
        throwError('INVALID_SITE_TOKEN_SECRET', 'Secret invalido para gerar token do site', 401);
      }

      const empresaId = parseInt(String(req.body?.empresaId || req.query.empresaId || '1'), 10);
      const payload = {
        id_usuario: 0,
        id_empresa: Number.isNaN(empresaId) ? 1 : empresaId,
        usuario: 'site',
        email: 'vendas@maggenta.com.br',
      };

      const token = generateNonExpiringToken(payload);
      successResponse(res, {
        token,
        type: 'Bearer',
        expires_in: null,
        payload,
      }, 'Token nao expiravel do site gerado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
