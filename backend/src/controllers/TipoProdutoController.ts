import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { CacheService } from '@services/CacheService';
import { TipoProdutoService } from '@services/TipoProdutoService';
import { errorResponse, successResponse } from '@utils/response';

const getEmpresaId = (req: AuthenticatedRequest): number =>
  parseInt((req.query.empresaId as string) || String(req.user?.id_empresa || 1), 10);

export class TipoProdutoController {
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await CacheService.getOrSet(
        CacheService.buildKey('tipos-produtos', `${getEmpresaId(req)}:${req.originalUrl}`),
        () =>
          TipoProdutoService.listTiposProdutos(
            getEmpresaId(req),
            parseInt((req.query.page as string) || '1', 10),
            parseInt((req.query.limit as string) || '100', 10),
            {
              search: req.query.search as string | undefined,
              habilitado: req.query.habilitado as string | undefined,
            }
          )
      );

      successResponse(res, result, 'Tipos de produtos listados com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async catalogo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await CacheService.getOrSet(
        CacheService.buildKey('tipos-produtos', `${getEmpresaId(req)}:${req.originalUrl}`),
        () =>
          TipoProdutoService.getCatalogoTipoProduto(
            getEmpresaId(req),
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

      successResponse(res, result, 'Catalogo do tipo de produto listado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
