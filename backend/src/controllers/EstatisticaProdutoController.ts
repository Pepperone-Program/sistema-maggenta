import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { EstatisticaProdutoService } from '@services/EstatisticaProdutoService';
import { errorResponse, successResponse } from '@utils/response';

const getEmpresaId = (req: AuthenticatedRequest): number => req.user?.id_empresa || 1;
const getLimit = (req: AuthenticatedRequest): number =>
  parseInt((req.query.limit as string) || '100', 10);

export class EstatisticaProdutoController {
  static async ranking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const ranking = await EstatisticaProdutoService.ranking(
        getEmpresaId(req),
        getLimit(req),
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined
      );
      successResponse(res, ranking, 'Ranking de produtos listado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async melhoresDoDia(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const ranking = await EstatisticaProdutoService.melhoresDoDia(
        getEmpresaId(req),
        getLimit(req),
        req.query.date as string | undefined
      );
      successResponse(res, ranking, 'Melhores produtos do dia listados com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async melhoresDoMes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const ranking = await EstatisticaProdutoService.melhoresDoMes(
        getEmpresaId(req),
        getLimit(req),
        req.query.date as string | undefined
      );
      successResponse(res, ranking, 'Melhores produtos do mes listados com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async melhoresDoAno(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const ranking = await EstatisticaProdutoService.melhoresDoAno(
        getEmpresaId(req),
        getLimit(req),
        req.query.date as string | undefined
      );
      successResponse(res, ranking, 'Melhores produtos do ano listados com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async resumo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const resumo = await EstatisticaProdutoService.resumo(
        getEmpresaId(req),
        getLimit(req),
        req.query.date as string | undefined
      );
      successResponse(res, resumo, 'Resumo de estatisticas de produtos listado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
