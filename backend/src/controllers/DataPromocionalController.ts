import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { CacheService } from '@services/CacheService';
import { DataPromocionalService } from '@services/DataPromocionalService';
import { errorResponse, paginatedResponse, successResponse } from '@utils/response';

const getEmpresaId = (req: AuthenticatedRequest): number => req.user?.id_empresa || 1;
const getPage = (req: AuthenticatedRequest): number =>
  parseInt((req.query.page as string) || '1', 10);
const getLimit = (req: AuthenticatedRequest): number =>
  parseInt((req.query.limit as string) || '10', 10);

export class DataPromocionalController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const dataPromocional = await DataPromocionalService.createDataPromocional(req.body);
      await CacheService.invalidateNamespace('datas-promocionais');
      await CacheService.invalidateNamespace('categorias');
      await CacheService.invalidateNamespace('tipos-produtos');
      successResponse(res, dataPromocional, 'Data promocional criada com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const dataPromocional = await CacheService.getOrSet(
        CacheService.buildKey('datas-promocionais', `${getEmpresaId(req)}:${req.originalUrl}`),
        () =>
          DataPromocionalService.getDataPromocionalById(
            parseInt(req.params.id, 10)
          )
      );
      successResponse(res, dataPromocional);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await CacheService.getOrSet(
        CacheService.buildKey('datas-promocionais', `${getEmpresaId(req)}:${req.originalUrl}`),
        () =>
          DataPromocionalService.listDatasPromocionais(
            getPage(req),
            getLimit(req),
            req.query.search as string | undefined,
            req.query.habilitado as string | undefined
          )
      );
      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Datas promocionais listadas com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const dataPromocional = await DataPromocionalService.updateDataPromocional(
        parseInt(req.params.id, 10),
        req.body
      );
      await CacheService.invalidateNamespace('datas-promocionais');
      await CacheService.invalidateNamespace('categorias');
      await CacheService.invalidateNamespace('tipos-produtos');
      successResponse(res, dataPromocional, 'Data promocional atualizada com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await DataPromocionalService.deleteDataPromocional(parseInt(req.params.id, 10));
      await CacheService.invalidateNamespace('datas-promocionais');
      await CacheService.invalidateNamespace('categorias');
      await CacheService.invalidateNamespace('tipos-produtos');
      successResponse(res, null, 'Data promocional deletada com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listProdutos(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await CacheService.getOrSet(
        CacheService.buildKey('datas-promocionais', `${getEmpresaId(req)}:${req.originalUrl}`),
        () =>
          DataPromocionalService.listProdutos(
            parseInt(req.params.id, 10),
            getPage(req),
            getLimit(req)
          )
      );
      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Produtos da data promocional listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async vincularProduto(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const vinculo = await DataPromocionalService.vincularProduto(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        req.body
      );
      await CacheService.invalidateNamespace('datas-promocionais');
      await CacheService.invalidateNamespace('categorias');
      await CacheService.invalidateNamespace('tipos-produtos');
      successResponse(res, vinculo, 'Produto vinculado a data promocional com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async desvincularProduto(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await DataPromocionalService.desvincularProduto(
        parseInt(req.params.id, 10),
        parseInt(req.params.produtoId, 10)
      );
      await CacheService.invalidateNamespace('datas-promocionais');
      await CacheService.invalidateNamespace('categorias');
      await CacheService.invalidateNamespace('tipos-produtos');
      successResponse(res, null, 'Produto desvinculado da data promocional com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
