import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { OrcamentoService } from '@services/OrcamentoService';
import { successResponse, paginatedResponse, errorResponse } from '@utils/response';

export class OrcamentoController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const orcamento = await OrcamentoService.createOrcamento(
        empresaId,
        req.body
      );

      successResponse(res, orcamento, 'Orçamento criado com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const includeItems = req.query.includeItems === 'true';
      const orcamento = await OrcamentoService.getOrcamentoById(
        empresaId,
        parseInt(id, 10),
        includeItems
      );

      successResponse(res, orcamento);
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

      const result = await OrcamentoService.listOrcamentos(
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
        'Orçamentos listados com sucesso'
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
      const orcamento = await OrcamentoService.updateOrcamento(
        empresaId,
        parseInt(id, 10),
        req.body
      );

      successResponse(res, orcamento, 'Orçamento atualizado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      await OrcamentoService.deleteOrcamento(
        empresaId,
        parseInt(id, 10)
      );

      successResponse(res, null, 'Orçamento deletado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async addItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const item = await OrcamentoService.addItemToOrcamento(
        empresaId,
        parseInt(id, 10),
        req.body
      );

      successResponse(res, item, 'Item adicionado ao orçamento com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async removeItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { itemId } = req.params;
      await OrcamentoService.removeItemFromOrcamento(parseInt(itemId, 10));

      successResponse(res, null, 'Item removido do orçamento com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
