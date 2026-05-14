import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { CacheService } from '@services/CacheService';
import { PublicoAlvoService } from '@services/PublicoAlvoService';
import { errorResponse, paginatedResponse, successResponse } from '@utils/response';

const getEmpresaId = (req: AuthenticatedRequest): number => req.user?.id_empresa || 1;
const getPage = (req: AuthenticatedRequest): number =>
  parseInt((req.query.page as string) || '1', 10);
const getLimit = (req: AuthenticatedRequest): number =>
  parseInt((req.query.limit as string) || '10', 10);

export class PublicoAlvoController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const publicoAlvo = await PublicoAlvoService.createPublicoAlvo(req.body);
      await CacheService.invalidateNamespace('publicos-alvos');
      await CacheService.invalidateNamespace('categorias');
      await CacheService.invalidateNamespace('tipos-produtos');
      await CacheService.invalidateNamespace('datas-promocionais');
      successResponse(res, publicoAlvo, 'Publico-alvo criado com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const publicoAlvo = await CacheService.getOrSet(
        CacheService.buildKey('publicos-alvos', `${getEmpresaId(req)}:${req.originalUrl}`),
        () => PublicoAlvoService.getPublicoAlvoById(parseInt(req.params.id, 10))
      );

      successResponse(res, publicoAlvo);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await CacheService.getOrSet(
        CacheService.buildKey('publicos-alvos', `${getEmpresaId(req)}:${req.originalUrl}`),
        () =>
          PublicoAlvoService.listPublicosAlvos(
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
        'Publicos-alvos listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const publicoAlvo = await PublicoAlvoService.updatePublicoAlvo(
        parseInt(req.params.id, 10),
        req.body
      );
      await CacheService.invalidateNamespace('publicos-alvos');
      await CacheService.invalidateNamespace('categorias');
      await CacheService.invalidateNamespace('tipos-produtos');
      await CacheService.invalidateNamespace('datas-promocionais');

      successResponse(res, publicoAlvo, 'Publico-alvo atualizado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await PublicoAlvoService.deletePublicoAlvo(parseInt(req.params.id, 10));
      await CacheService.invalidateNamespace('publicos-alvos');
      await CacheService.invalidateNamespace('categorias');
      await CacheService.invalidateNamespace('tipos-produtos');
      await CacheService.invalidateNamespace('datas-promocionais');
      successResponse(res, null, 'Publico-alvo deletado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listProdutos(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await PublicoAlvoService.listProdutos(
        parseInt(req.params.id, 10),
        getPage(req),
        getLimit(req)
      );

      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Produtos do publico-alvo listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async catalogo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = parseInt((req.query.empresaId as string) || String(getEmpresaId(req)), 10);
      const result = await CacheService.getOrSet(
        CacheService.buildKey('publicos-alvos', `${empresaId}:${req.originalUrl}`),
        () =>
          PublicoAlvoService.getCatalogoPublicoAlvo(
            empresaId,
            parseInt(req.params.id, 10),
            {
              page: req.query.page as string | undefined,
              limit: req.query.limit as string | undefined,
              subcategorias: req.query.subcategorias as string | undefined,
              publicos_alvos: req.query.publicos_alvos as string | undefined,
              datas_promocionais: req.query.datas_promocionais as string | undefined,
              quantidade_minima_min: req.query.quantidade_minima_min as string | undefined,
              quantidade_minima_max: req.query.quantidade_minima_max as string | undefined,
            }
          )
      );

      successResponse(res, result, 'Catalogo do publico-alvo listado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async vincularProduto(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const vinculo = await PublicoAlvoService.vincularProduto(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        req.body
      );
      await CacheService.invalidateNamespace('publicos-alvos');
      await CacheService.invalidateNamespace('categorias');
      await CacheService.invalidateNamespace('tipos-produtos');
      await CacheService.invalidateNamespace('datas-promocionais');

      successResponse(res, vinculo, 'Produto vinculado ao publico-alvo com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async desvincularProduto(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await PublicoAlvoService.desvincularProduto(
        parseInt(req.params.id, 10),
        parseInt(req.params.produtoId, 10)
      );
      await CacheService.invalidateNamespace('publicos-alvos');
      await CacheService.invalidateNamespace('categorias');
      await CacheService.invalidateNamespace('tipos-produtos');
      await CacheService.invalidateNamespace('datas-promocionais');

      successResponse(res, null, 'Produto desvinculado do publico-alvo com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
