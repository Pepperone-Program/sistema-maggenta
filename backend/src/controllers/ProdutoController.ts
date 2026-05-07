import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { ProdutoService } from '@services/ProdutoService';
import { ProdutoImageService } from '@services/ProdutoImageService';
import { successResponse, paginatedResponse, errorResponse } from '@utils/response';

export class ProdutoController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const produto = await ProdutoService.createProduto(
        empresaId,
        req.body
      );

      successResponse(res, produto, 'Produto criado com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const produto = await ProdutoService.getProdutoById(
        empresaId,
        parseInt(id, 10)
      );

      successResponse(res, produto);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '10', 10);
      const search = req.query.search as string | undefined;

      const result = await ProdutoService.listProdutos(
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
        'Produtos listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listSite(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = parseInt((req.query.empresaId as string) || '1', 10);
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '10', 10);
      const search = req.query.search as string | undefined;

      const result = await ProdutoService.listProdutosSite(
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
        'Produtos do site listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async searchSite(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = parseInt((req.query.empresaId as string) || '1', 10);
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '10', 10);
      const term = String(req.query.q || '');

      const result = await ProdutoService.searchProdutosSite(
        empresaId,
        term,
        page,
        limit
      );

      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Produtos encontrados com sucesso'
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
      const produto = await ProdutoService.updateProduto(
        empresaId,
        parseInt(id, 10),
        req.body
      );

      successResponse(res, produto, 'Produto atualizado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      await ProdutoService.deleteProduto(
        empresaId,
        parseInt(id, 10)
      );

      successResponse(res, null, 'Produto deletado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listImages(req: AuthenticatedRequest, res: Response): Promise<void> {
    const startedAt = Date.now();
    console.log('[ProdutoController] listImages:start', {
      produtoId: req.params.id,
      empresaId: req.user?.id_empresa,
      userId: req.user?.id_usuario,
      path: req.path,
      method: req.method,
    });
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const imagens = await ProdutoImageService.list(empresaId, parseInt(id, 10));

      console.log('[ProdutoController] listImages:success', {
        produtoId: id,
        empresaId,
        imageCount: imagens.length,
        tookMs: Date.now() - startedAt,
      });
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      successResponse(res, imagens, 'Imagens listadas com sucesso');
    } catch (error) {
      const err = error as any;
      console.error('[ProdutoController] listImages:error', {
        produtoId: req.params.id,
        empresaId: req.user?.id_empresa,
        code: err?.code,
        message: err?.message,
        stack: err?.stack,
        tookMs: Date.now() - startedAt,
      });
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async uploadImages(req: AuthenticatedRequest, res: Response): Promise<void> {
    const startedAt = Date.now();
    console.log('[ProdutoController] uploadImages:start', {
      produtoId: req.params.id,
      empresaId: req.user?.id_empresa,
      userId: req.user?.id_usuario,
      fileCount: Array.isArray(req.files) ? req.files.length : 0,
    });
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const files = (req.files || []) as Express.Multer.File[];
      const imagens = await ProdutoImageService.upload(empresaId, parseInt(id, 10), files);

      console.log('[ProdutoController] uploadImages:success', {
        produtoId: id,
        empresaId,
        imageCount: imagens.length,
        tookMs: Date.now() - startedAt,
      });
      successResponse(res, imagens, 'Imagens enviadas com sucesso', 201);
    } catch (error) {
      const err = error as any;
      console.error('[ProdutoController] uploadImages:error', {
        produtoId: req.params.id,
        empresaId: req.user?.id_empresa,
        code: err?.code,
        message: err?.message,
        stack: err?.stack,
        tookMs: Date.now() - startedAt,
      });
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async reorderImages(req: AuthenticatedRequest, res: Response): Promise<void> {
    const startedAt = Date.now();
    console.log('[ProdutoController] reorderImages:start', {
      produtoId: req.params.id,
      empresaId: req.user?.id_empresa,
      userId: req.user?.id_usuario,
      filenames: req.body?.filenames,
    });
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const imagens = await ProdutoImageService.reorder(
        empresaId,
        parseInt(id, 10),
        req.body.filenames || []
      );

      console.log('[ProdutoController] reorderImages:success', {
        produtoId: id,
        empresaId,
        imageCount: imagens.length,
        tookMs: Date.now() - startedAt,
      });
      successResponse(res, imagens, 'Imagens reordenadas com sucesso');
    } catch (error) {
      const err = error as any;
      console.error('[ProdutoController] reorderImages:error', {
        produtoId: req.params.id,
        empresaId: req.user?.id_empresa,
        code: err?.code,
        message: err?.message,
        stack: err?.stack,
        tookMs: Date.now() - startedAt,
      });
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async removeImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    const startedAt = Date.now();
    console.log('[ProdutoController] removeImage:start', {
      produtoId: req.params.id,
      filename: req.params.filename,
      empresaId: req.user?.id_empresa,
      userId: req.user?.id_usuario,
    });
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id, filename } = req.params;
      const imagens = await ProdutoImageService.remove(
        empresaId,
        parseInt(id, 10),
        filename
      );

      console.log('[ProdutoController] removeImage:success', {
        produtoId: id,
        filename,
        empresaId,
        imageCount: imagens.length,
        tookMs: Date.now() - startedAt,
      });
      successResponse(res, imagens, 'Imagem removida com sucesso');
    } catch (error) {
      const err = error as any;
      console.error('[ProdutoController] removeImage:error', {
        produtoId: req.params.id,
        filename: req.params.filename,
        empresaId: req.user?.id_empresa,
        code: err?.code,
        message: err?.message,
        stack: err?.stack,
        tookMs: Date.now() - startedAt,
      });
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async viewImage(req: AuthenticatedRequest, res: Response): Promise<void> {
    const startedAt = Date.now();
    console.log('[ProdutoController] viewImage:start', {
      produtoId: req.params.id,
      filename: req.params.filename,
      folder: req.query.folder,
      empresaId: req.user?.id_empresa,
      userId: req.user?.id_usuario,
    });
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id, filename } = req.params;
      const folder = req.query.folder === 'alta' ? 'alta' : 'thumb';
      const buffer = await ProdutoImageService.getImageBuffer(
        empresaId,
        parseInt(id, 10),
        filename,
        folder
      );

      console.log('[ProdutoController] viewImage:success', {
        produtoId: id,
        filename,
        folder,
        bytes: buffer.length,
        tookMs: Date.now() - startedAt,
      });
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.status(200).send(buffer);
    } catch (error) {
      const err = error as any;
      console.error('[ProdutoController] viewImage:error', {
        produtoId: req.params.id,
        filename: req.params.filename,
        empresaId: req.user?.id_empresa,
        code: err?.code,
        message: err?.message,
        stack: err?.stack,
        tookMs: Date.now() - startedAt,
      });
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
