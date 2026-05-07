import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { BannerService } from '@services/BannerService';
import { errorResponse, successResponse } from '@utils/response';

const getEmpresaId = (req: AuthenticatedRequest): number => req.user?.id_empresa || 1;
const getPage = (req: AuthenticatedRequest): number => parseInt((req.query.page as string) || '1', 10);
const getLimit = (req: AuthenticatedRequest): number => parseInt((req.query.limit as string) || '50', 10);

export class BannerController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const banner = await BannerService.createBanner(getEmpresaId(req), req.body);
      successResponse(res, banner, 'Banner criado com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const banner = await BannerService.getBannerById(
        getEmpresaId(req),
        parseInt(req.params.id, 10)
      );
      successResponse(res, {
        item: banner,
        grouped: BannerService.groupByTipo([banner]),
      });
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await BannerService.listBanners(
        getEmpresaId(req),
        getPage(req),
        getLimit(req),
        {
          search: req.query.search as string | undefined,
          habilitado: req.query.habilitado as string | undefined,
          tipo: req.query.tipo as string | undefined,
        }
      );
      successResponse(res, result, 'Banners listados com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listActive(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await BannerService.listActiveBanners(
        getEmpresaId(req),
        req.query.tipo as string | undefined
      );
      successResponse(res, result, 'Banners ativos listados com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const banner = await BannerService.updateBanner(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        req.body
      );
      successResponse(res, banner, 'Banner atualizado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await BannerService.deleteBanner(getEmpresaId(req), parseInt(req.params.id, 10));
      successResponse(res, null, 'Banner deletado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
