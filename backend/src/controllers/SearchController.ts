import type { Response } from 'express';
import type { AuthenticatedRequest } from '@middleware/auth';
import { errorResponse, successResponse } from '@utils/response';
import { CandidateRetriever } from '@search/CandidateRetriever';
import { ProductRankingEngine } from '@search/ProductRankingEngine';
import { ProductSearchService } from '@search/ProductSearchService';
import { PublicSearchTenantResolver } from '@search/PublicSearchTenantResolver';
import { QueryNormalizer } from '@search/QueryNormalizer';
import { QueryParser } from '@search/QueryParser';
import { SearchAdminService } from '@search/SearchAdminService';
import { SearchAnalyticsService } from '@search/SearchAnalyticsService';
import { SearchAutocompleteService } from '@search/SearchAutocompleteService';
import { SearchDictionaryService } from '@search/SearchDictionaryService';
import { SearchMetrics } from '@search/SearchMetrics';
import type { SearchSort } from '@/types/search';

type Entity = 'dictionary' | 'attributes' | 'options' | 'conflicts';
const entities = new Set<Entity>(['dictionary', 'attributes', 'options', 'conflicts']);
const fail = (res: Response, error: unknown): void => {
  const err = error as { code?: string; message?: string; statusCode?: number };
  errorResponse(res, err.code || 'SEARCH_ERROR', err.message || 'Erro no mecanismo de busca', err.statusCode || 500);
};
const idParam = (value: string, name = 'id'): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw Object.assign(new Error(`${name} invalido`), { code: 'INVALID_SEARCH_ID', statusCode: 422 });
  return parsed;
};

export class SearchController {
  static async autocomplete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = PublicSearchTenantResolver.resolve(req);
      const items = await SearchAutocompleteService.autocomplete(empresaId, String(req.query.q || ''), Number(req.query.limit || 8));
      successResponse(res, { items, query: String(req.query.q || '') });
    } catch (error) { fail(res, error); }
  }

  static async click(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = PublicSearchTenantResolver.resolve(req);
      const searchId = String(req.body.searchId || req.body.search_id || '');
      const produtoId = Number(req.body.productId || req.body.id_produto);
      const position = Number(req.body.position);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(searchId) || !Number.isInteger(produtoId) || produtoId <= 0 || !Number.isInteger(position) || position < 1) {
        errorResponse(res, 'INVALID_SEARCH_CLICK', 'searchId, productId e position validos sao obrigatorios', 422);
        return;
      }
      await SearchAnalyticsService.flush();
      await SearchAnalyticsService.recordClick(empresaId, searchId, produtoId, position);
      successResponse(res, null, 'Clique registrado', 202);
    } catch (error) { fail(res, error); }
  }

  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const entity = String(req.params.entity) as Entity;
      if (!entities.has(entity)) throw Object.assign(new Error('Entidade de busca invalida'), { code: 'INVALID_SEARCH_ENTITY', statusCode: 404 });
      successResponse(res, await SearchAdminService.list(req.user!.id_empresa, entity));
    } catch (error) { fail(res, error); }
  }

  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const entity = String(req.params.entity) as Entity;
      if (!entities.has(entity)) throw Object.assign(new Error('Entidade de busca invalida'), { code: 'INVALID_SEARCH_ENTITY', statusCode: 404 });
      successResponse(res, await SearchAdminService.create(req.user!.id_empresa, entity, req.body), 'Registro criado', 201);
    } catch (error) { fail(res, error); }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const entity = String(req.params.entity) as Entity;
      if (!entities.has(entity)) throw Object.assign(new Error('Entidade de busca invalida'), { code: 'INVALID_SEARCH_ENTITY', statusCode: 404 });
      successResponse(res, await SearchAdminService.update(req.user!.id_empresa, entity, idParam(req.params.id), req.body), 'Registro atualizado');
    } catch (error) { fail(res, error); }
  }

  static async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const entity = String(req.params.entity) as Entity;
      if (!entities.has(entity)) throw Object.assign(new Error('Entidade de busca invalida'), { code: 'INVALID_SEARCH_ENTITY', statusCode: 404 });
      await SearchAdminService.remove(req.user!.id_empresa, entity, idParam(req.params.id), req.query.conflictingOptionId ? idParam(String(req.query.conflictingOptionId), 'conflictingOptionId') : undefined);
      successResponse(res, null, 'Registro removido');
    } catch (error) { fail(res, error); }
  }

  static async getMetadata(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      successResponse(res, await SearchAdminService.getProductMetadata(req.user!.id_empresa, idParam(req.params.id)));
    } catch (error) { fail(res, error); }
  }

  static async putMetadata(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      successResponse(res, await SearchAdminService.replaceProductMetadata(
        req.user!.id_empresa,
        idParam(req.params.id),
        req.user!.id_usuario,
        req.body.attributes || [],
        req.body.containsTypeIds || []
      ), 'Metadados manuais substituidos');
    } catch (error) { fail(res, error); }
  }

  static async debug(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user!.id_empresa;
      const normalized = QueryNormalizer.normalize(String(req.query.q || ''));
      const dictionary = await SearchDictionaryService.getEntries(empresaId);
      const intent = QueryParser.parse(normalized, dictionary);
      const retrieval = await CandidateRetriever.retrieve(empresaId, intent, {});
      const sort: SearchSort = ['newest', 'popular'].includes(String(req.query.sort)) ? String(req.query.sort) as SearchSort : 'relevance';
      const ranked = ProductRankingEngine.rank(retrieval.candidates, intent, sort).slice(0, 50).map((item) => ({
        idProduto: item.candidate.idProduto,
        codigo: item.candidate.codigo,
        produto: item.candidate.produto,
        group: item.group,
        excluded: item.excluded,
        primaryTypeMatch: item.primaryTypeMatch,
        matchedConstraints: item.matchedConstraints,
        contradictions: item.contradictions,
        score: item.score,
      }));
      successResponse(res, { normalized, intent, candidates: retrieval.candidates.length, databaseTimeMs: retrieval.databaseTimeMs, ranked });
    } catch (error) { fail(res, error); }
  }

  static async forcedSearch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await ProductSearchService.search({
        empresaId: req.user!.id_empresa,
        term: String(req.query.q || ''),
        page: 1,
        limit: Math.min(Math.max(Math.trunc(Number(req.query.limit || 20)) || 20, 1), 40),
        sort: 'relevance',
        filters: {},
        locale: 'pt-BR',
        forceAdvanced: true,
      });
      successResponse(res, result);
    } catch (error) { fail(res, error); }
  }

  static metrics(req: AuthenticatedRequest, res: Response): void {
    const configured = process.env.METRICS_TOKEN;
    const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!configured || supplied !== configured) {
      errorResponse(res, 'FORBIDDEN', 'Token de metricas invalido', 403);
      return;
    }
    res.type('text/plain; version=0.0.4').send(SearchMetrics.render());
  }
}
