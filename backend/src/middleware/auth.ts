import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@utils/helpers';
import { errorResponse } from '@utils/response';

export interface AuthenticatedRequest extends Request {
  user?: {
    id_usuario: number;
    id_empresa: number;
    usuario: string;
    email: string;
  };
}

const getSiteTokenUser = (token?: string): AuthenticatedRequest['user'] | null => {
  const siteApiToken = process.env.SITE_API_TOKEN?.trim();
  if (!token || !siteApiToken || token !== siteApiToken) {
    return null;
  }

  const empresaId = Number(process.env.SITE_API_EMPRESA_ID || 1);
  return {
    id_usuario: 0,
    id_empresa: Number.isInteger(empresaId) && empresaId > 0 ? empresaId : 1,
    usuario: process.env.SITE_API_USUARIO || 'site',
    email: process.env.SITE_API_EMAIL || process.env.RESEND_FROM_EMAIL || 'site@maggenta.com.br',
  };
};

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      errorResponse(res, 'NO_TOKEN', 'Token not provided', 401);
      return;
    }

    const siteTokenUser = getSiteTokenUser(token);
    req.user = siteTokenUser || verifyToken(token);
    next();
  } catch (error) {
    errorResponse(res, 'INVALID_TOKEN', 'Invalid or expired token', 401);
  }
};

export const optionalAuthMiddleware = (
  req: AuthenticatedRequest,
    _res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const siteTokenUser = getSiteTokenUser(token);
      req.user = siteTokenUser || verifyToken(token);
    }
    next();
  } catch (error) {
    next();
  }
};
