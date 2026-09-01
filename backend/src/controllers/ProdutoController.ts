import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { CacheService } from '@services/CacheService';
import { ProdutoService } from '@services/ProdutoService';
import { ProdutoImageService } from '@services/ProdutoImageService';
import { successResponse, paginatedResponse, errorResponse } from '@utils/response';
import { ProductSearchService } from '@search/ProductSearchService';
import { PublicSearchTenantResolver } from '@search/PublicSearchTenantResolver';
import type { SearchFilters, SearchSort } from '@/types/search';
import { SearchCursorCodec } from '@search/SearchCursorCodec';
import { comparableSearchText } from '@search/QueryNormalizer';
import { GenerateAiDescriptionService } from '@services/generateAiDescriptionService';

async function invalidateProductCaches(): Promise<void> {
  await CacheService.invalidateNamespaces(CacheService.productContentNamespaces);
}

export class ProdutoController {
  static async generateAiDescription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa;
      const produtoId = Number(req.params.id);
      if (!empresaId) {
        errorResponse(res, 'UNAUTHENTICATED_COMPANY', 'Empresa da sessão não identificada', 401);
        return;
      }
      if (!Number.isInteger(produtoId) || produtoId <= 0) {
        errorResponse(res, 'INVALID_PRODUCT', 'Produto inválido', 400);
        return;
      }

      const result = await GenerateAiDescriptionService.generateForProduct(empresaId, produtoId);
      await invalidateProductCaches();
      successResponse(res, result, 'Descrição gerada e salva com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'AI_GENERATION_ERROR', err.message, err.statusCode || 500);
    }
  }

  static async exportSpreadsheet(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const arquivo = await ProdutoService.gerarPlanilhaProdutosSite(empresaId);
      const data = new Date().toISOString().slice(0, 10);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="produtos-site-${data}.xlsx"`);
      res.setHeader('Content-Length', arquivo.length);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).send(arquivo);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'EXPORT_ERROR', err.message, err.statusCode || 500);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const produto = await ProdutoService.createProduto(
        empresaId,
        req.body
      );
      await invalidateProductCaches();

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
      const produto = await CacheService.getOrSet(
        CacheService.buildKey('produtos', `${empresaId}:${req.originalUrl}`),
        () =>
          ProdutoService.getProdutoById(
            empresaId,
            parseInt(id, 10)
          )
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
      const limit = parseInt((req.query.limit as string) || '100', 10);
      const search = req.query.search as string | undefined;
      const habilitado = req.query.habilitado as string | undefined;
      const site = req.query.site as string | undefined;
      const categoriaId = Number(req.query.id_categoria) || undefined;
      const tipoProdutoId = Number(req.query.id_tipo_produto) || undefined;
      const subcategoriaId = Number(req.query.id_subcategoria) || undefined;
      const order = req.query.order === 'ASC' ? 'ASC' : 'DESC';

      const result = await CacheService.getOrSet(
        CacheService.buildKey('produtos', `${empresaId}:${req.originalUrl}`),
        () =>
          ProdutoService.listProdutos(
            empresaId,
            page,
            limit,
            search,
            habilitado,
            site,
            categoriaId,
            tipoProdutoId,
            subcategoriaId,
            order
          )
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
      const searchTerm = String(req.query.busca || req.query.search || '').trim();
      if (searchTerm) {
        req.query.q = searchTerm;
        await ProdutoController.searchSite(req, res);
        return;
      }
      const empresaId = parseInt((req.query.empresaId as string) || '1', 10);
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '100', 10);

      const result = await CacheService.getOrSet(
        CacheService.buildKey('produtos', `${empresaId}:${req.originalUrl}`),
        () =>
          ProdutoService.listProdutosSite(
            empresaId,
            page,
            limit
          )
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
      const unsupportedNames = new Set(['price', 'minprice', 'maxprice', 'preco', 'precomin', 'precomax', 'preco_min', 'preco_max', 'brand', 'brandid', 'id_marca', 'marca', 'stock', 'estoque']);
      const unsupported = Object.keys(req.query).filter((key) => unsupportedNames.has(key.toLocaleLowerCase('pt-BR')));
      if (unsupported.length) {
        errorResponse(res, 'UNSUPPORTED_SEARCH_FILTER', 'Preco, marca e estoque ainda nao possuem fonte publica isolada por tenant', 422, { filters: unsupported });
        return;
      }
      const empresaId = PublicSearchTenantResolver.resolve(req);
      const requestedPage = Number(req.query.page || 1);
      const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const requestedLimit = Number(req.query.limit || 20);
      const limit = Math.min(Math.max(Number.isInteger(requestedLimit) ? requestedLimit : 20, 1), 40);
      const term = String(req.query.q || req.query.busca || req.query.search || '');
      const positiveInt = (value: unknown): number | undefined => {
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
      };
      const filters: SearchFilters = {
        categoryId: positiveInt(req.query.categoryId || req.query.id_categoria),
        subcategoryId: positiveInt(req.query.subcategoryId || req.query.id_subcategoria),
        productTypeId: positiveInt(req.query.productTypeId || req.query.id_tipo_produto),
        material: req.query.material ? comparableSearchText(String(req.query.material)) : undefined,
        color: req.query.color ? String(req.query.color).trim() : undefined,
        recordingTypeId: positiveInt(req.query.recordingTypeId || req.query.id_tipo_gravacao),
        maximumMinimumQuantity: positiveInt(req.query.maximumMinimumQuantity || req.query.quantidade_minima),
      };
      const requestedSort = String(req.query.sort || 'relevance');
      const sortAliases: Record<string, SearchSort> = {
        relevance: 'relevance', relevancia: 'relevance', newest: 'newest', mais_recentes: 'newest',
        popular: 'popular', popularidade: 'popular',
      };
      const sort = sortAliases[requestedSort] || 'relevance';
      const result = await ProductSearchService.search({
        empresaId,
        term,
        page,
        limit,
        cursor: req.query.cursor ? String(req.query.cursor) : undefined,
        sort,
        filters,
        locale: String(req.query.locale || 'pt-BR'),
      });

      console.log(JSON.stringify({
        event: 'product_search',
        requestId: (req as AuthenticatedRequest & { requestId?: string }).requestId,
        searchId: result.match_exato_codigo ? undefined : result.searchId,
        queryHash: SearchCursorCodec.queryHash(term.trim().toLocaleLowerCase('pt-BR')),
        empresaId,
        mode: result.match_exato_codigo ? 'exact_code' : result.mode,
      }));

      if (result.match_exato_codigo === true) {
        successResponse(
          res,
          {
            match_exato_codigo: true,
            id_produto: result.id_produto,
            codigo: result.codigo,
          },
          'Produto encontrado por codigo exato'
        );
        return;
      }

      successResponse(res, result, 'Produtos encontrados com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500, err.details);
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
      await invalidateProductCaches();

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
      await invalidateProductCaches();

      successResponse(res, null, 'Produto deletado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listLinks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const links = await ProdutoService.getProdutoLinks(empresaId, parseInt(id, 10));

      successResponse(res, links, 'Vinculos do produto listados com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listSubcategorias(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const subcategorias = await ProdutoService.listSubcategoriasVinculadas(
        empresaId,
        parseInt(id, 10)
      );

      successResponse(res, subcategorias, 'Subcategorias do produto listadas com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async vincularSubcategoria(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user?.id_empresa || 1;
      const vinculo = await ProdutoService.vincularSubcategoria(
        empresaId,
        parseInt(req.params.id, 10),
        parseInt(req.params.subcategoriaId, 10)
      );
      await invalidateProductCaches();

      successResponse(res, vinculo, 'Subcategoria vinculada ao produto com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async desvincularSubcategoria(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.query.empresaId
        ? parseInt(String(req.query.empresaId), 10)
        : req.user?.id_empresa || 1;
      await ProdutoService.desvincularSubcategoriaDireta(
        empresaId,
        parseInt(req.params.id, 10),
        parseInt(req.params.subcategoriaId, 10)
      );
      await invalidateProductCaches();

      successResponse(res, null, 'Subcategoria desvinculada do produto com sucesso');
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
      await invalidateProductCaches();

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
    const orderedImages =
      req.body?.imageIds ||
      req.body?.id_imagens ||
      req.body?.ids ||
      req.body?.filenames ||
      req.body?.images ||
      [];

    console.log('[ProdutoController] reorderImages:start', {
      produtoId: req.params.id,
      empresaId: req.user?.id_empresa,
      userId: req.user?.id_usuario,
      imageIds: req.body?.imageIds,
      bodyKeys: Object.keys(req.body || {}),
    });
    try {
      const empresaId = req.user?.id_empresa || 1;
      const { id } = req.params;
      const imagens = await ProdutoImageService.reorder(
        empresaId,
        parseInt(id, 10),
        orderedImages
      );
      await invalidateProductCaches();

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
      await invalidateProductCaches();

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
