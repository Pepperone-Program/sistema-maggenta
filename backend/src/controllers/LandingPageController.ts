import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { LandingPageService } from '@services/LandingPageService';
import { CacheService } from '@services/CacheService';
import { errorResponse, successResponse } from '@utils/response';

const positiveInteger = (value: unknown, fallback: number, maximum?: number): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return maximum ? Math.min(parsed, maximum) : parsed;
};

const handleError = (res: Response, error: unknown): void => {
  const err = error as { code?: string; message?: string; statusCode?: number };
  errorResponse(res, err.code || 'ERROR', err.message || 'Erro interno', err.statusCode || 500);
};

export class LandingPageController {
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const page = positiveInteger(req.query.page, 1);
      const limit = positiveInteger(req.query.limit, 20, 100);
      const search = String(req.query.search || '').trim() || undefined;
      const result = await CacheService.getOrSet(
        CacheService.buildKey('landing-pages', req.originalUrl),
        () => LandingPageService.list(page, limit, search)
      );
      successResponse(res, result, 'Landing pages listadas com sucesso');
    } catch (error) {
      handleError(res, error);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = positiveInteger(req.params.id, 0);
      if (!id) return errorResponse(res, 'INVALID_ID', 'ID invalido', 400);
      const item = await CacheService.getOrSet(
        CacheService.buildKey('landing-pages', `id:${id}`),
        () => LandingPageService.getById(id)
      );
      successResponse(res, item);
    } catch (error) {
      handleError(res, error);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const item = await LandingPageService.create(req.body);
      await CacheService.invalidateNamespace('landing-pages');
      successResponse(res, item, 'Landing page criada com sucesso', 201);
    } catch (error) {
      handleError(res, error);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = positiveInteger(req.params.id, 0);
      if (!id) return errorResponse(res, 'INVALID_ID', 'ID invalido', 400);
      const item = await LandingPageService.update(id, req.body);
      await CacheService.invalidateNamespace('landing-pages');
      successResponse(res, item, 'Landing page atualizada com sucesso');
    } catch (error) {
      handleError(res, error);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = positiveInteger(req.params.id, 0);
      if (!id) return errorResponse(res, 'INVALID_ID', 'ID invalido', 400);
      await LandingPageService.delete(id);
      await CacheService.invalidateNamespace('landing-pages');
      successResponse(res, null, 'Landing page excluida com sucesso');
    } catch (error) {
      handleError(res, error);
    }
  }
}
