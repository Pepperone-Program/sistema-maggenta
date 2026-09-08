import crypto from 'crypto';
import { ProdutoModel } from '@models/Produto';
import { CandidateRetriever } from './CandidateRetriever';
import { ProductRankingEngine } from './ProductRankingEngine';
import { QueryNormalizer } from './QueryNormalizer';
import { QueryParser } from './QueryParser';
import { SearchAnalyticsService } from './SearchAnalyticsService';
import { SearchCircuitBreaker } from './SearchCircuitBreaker';
import { SearchCursorCodec } from './SearchCursorCodec';
import { SearchDictionaryService } from './SearchDictionaryService';
import { SearchMetrics } from './SearchMetrics';
import { SearchCacheService } from './SearchCacheService';
import { SearchConcurrencyLimiter } from './SearchConcurrencyLimiter';
import { SEARCH_LIMITS, SEARCH_RANKING_VERSION } from './config';
import type { Produto } from '@/types/produto';
import type { SearchCursor, SearchFilters, SearchResult, SearchSort } from '@/types/search';

export type ProductSearchResponse =
  | { match_exato_codigo: true; id_produto: number; codigo: string }
  | ({ match_exato_codigo: false } & SearchResult<Produto>);

type SearchInput = {
  empresaId: number;
  term: string;
  page: number;
  limit: number;
  cursor?: string;
  sort: SearchSort;
  filters: SearchFilters;
  locale: string;
  forceAdvanced?: boolean;
};

export type RankingPlanItem = {
  idProduto: number;
  group: 'PRIMARY' | 'RELATED';
  relevance: 'HIGH' | 'MEDIUM' | 'LOW';
  cursorTuple: SearchCursor['last'];
};

type RankingPlan = {
  items: RankingPlanItem[];
  candidateCount: number;
  databaseTimeMs: number;
  rankingTimeMs: number;
};

export const paginateRankingItems = (
  items: RankingPlanItem[],
  page: number,
  limit: number,
  cursor: SearchCursor['last'] | null,
  sort: SearchSort,
): { items: RankingPlanItem[]; total: number; totalPages: number; hasNext: boolean } => {
  const eligible = cursor
    ? items.filter((item) => SearchCursorCodec.isTupleAfterCursor(item.cursorTuple, cursor, sort))
    : items;
  const offset = cursor ? 0 : (page - 1) * limit;
  return {
    items: eligible.slice(offset, offset + limit),
    total: items.length,
    totalPages: Math.ceil(items.length / limit),
    hasNext: offset + limit < eligible.length,
  };
};

const structuredError = (code: string, message: string, statusCode: number): Error =>
  Object.assign(new Error(message), { code, statusCode });

const withTimeout = async <T>(operation: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(structuredError('SEARCH_TIMEOUT', 'A busca excedeu o tempo limite', 503)),
          SEARCH_LIMITS.applicationTimeoutMs,
        );
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export class ProductSearchService {
  static async search(input: SearchInput): Promise<ProductSearchResponse> {
    const term = String(input.term || '').trim();
    if (!term) throw structuredError('INVALID_SEARCH', 'Informe o termo de busca em q', 400);

    try {
      return await withTimeout(
        SearchConcurrencyLimiter.run(async () => {
          const suffixMatch = await ProdutoModel.findByExactCodeForSite(input.empresaId, term + 'C');
          const exactMatch =
            suffixMatch || (await ProdutoModel.findByExactCodeForSite(input.empresaId, term));
          if (exactMatch)
            return {
              match_exato_codigo: true as const,
              id_produto: exactMatch.id_produto,
              codigo: exactMatch.codigo,
            };
          const normalized = QueryNormalizer.normalize(term);
          QueryParser.parse(normalized);
          if (SearchCircuitBreaker.isOpen()) {
            throw structuredError('SEARCH_UNAVAILABLE', 'Busca temporariamente indisponivel', 503);
          }
          return this.advanced(input, normalized.comparable);
        }),
      );
    } catch (error) {
      const code = String((error as { code?: string }).code || 'SEARCH_UNAVAILABLE');
      SearchMetrics.increment('product_search_errors_total', { code });
      SearchCircuitBreaker.failure(error);
      if (Number((error as { statusCode?: number }).statusCode) === 422) throw error;
      throw Object.assign(structuredError('SEARCH_UNAVAILABLE', 'Busca temporariamente indisponivel', 503), {
        cause: error,
      });
    }
  }

  private static async advanced(
    input: SearchInput,
    comparable: string,
    analyticsMode: 'advanced' = 'advanced',
  ): Promise<ProductSearchResponse> {
    const totalStartedAt = Date.now();
    const parseStartedAt = Date.now();
    await SearchDictionaryService.assertCatalogReady(input.empresaId);
    const versions = await SearchDictionaryService.getCatalogVersion(input.empresaId);
    const normalized = QueryNormalizer.normalize(input.term);
    const intent = QueryParser.parse(normalized);
    const parseTimeMs = Date.now() - parseStartedAt;
    const queryHash = SearchCursorCodec.queryHash(
      SearchCacheService.resultKey({ query: comparable, filters: input.filters, locale: input.locale }),
    );
    const decodedCursor = input.cursor ? SearchCursorCodec.decode(input.cursor) : null;
    if (
      decodedCursor &&
      (decodedCursor.tenantId !== input.empresaId ||
        decodedCursor.catalogVersion !== versions.catalogVersion ||
        decodedCursor.rankingVersion !== SEARCH_RANKING_VERSION ||
        decodedCursor.queryHash !== queryHash ||
        decodedCursor.sort !== input.sort)
    ) {
      throw structuredError('INVALID_SEARCH_CURSOR', 'Cursor nao pertence a esta busca ou versao', 422);
    }

    const rankingKeyInput = {
      tenant: input.empresaId,
      query: comparable,
      filters: input.filters,
      locale: input.locale,
      sort: input.sort,
      rankingVersion: SEARCH_RANKING_VERSION,
      catalogVersion: versions.catalogVersion,
    };
    const cached = await SearchCacheService.getOrSetRankingPlan<RankingPlan>(rankingKeyInput, async () => {
      const retrieval = await CandidateRetriever.retrieve(input.empresaId, intent, input.filters);
      const rankingStartedAt = Date.now();
      const ranked = ProductRankingEngine.rank(retrieval.candidates, intent, input.sort).filter(
        (item) => !item.excluded,
      );
      const compact = (item: (typeof ranked)[number]): RankingPlanItem => ({
        idProduto: item.candidate.idProduto,
        group: item.group,
        relevance: item.relevance,
        cursorTuple: SearchCursorCodec.tuple(item),
      });
      return {
        items: ranked.map(compact),
        candidateCount: retrieval.candidates.length,
        databaseTimeMs: retrieval.databaseTimeMs,
        rankingTimeMs: Date.now() - rankingStartedAt,
      };
    });
    const plan = cached.value;
    const pageResult = paginateRankingItems(
      plan.items,
      input.page,
      input.limit,
      decodedCursor?.last || null,
      input.sort,
    );
    const pageItems = pageResult.items;
    const hydrationStartedAt = Date.now();
    const hydrated = await this.productsWithImages(
      input.empresaId,
      pageItems.map((item) => item.idProduto),
    );
    const hydrationTimeMs = Date.now() - hydrationStartedAt;
    const productsById = new Map(hydrated.map((product) => [Number(product.id_produto), product]));
    const items = pageItems
      .map((item) => productsById.get(item.idProduto))
      .filter((item): item is Produto => Boolean(item));
    const nextItem = pageResult.hasNext ? pageItems[pageItems.length - 1] : undefined;
    const nextCursor = nextItem
      ? SearchCursorCodec.encode({
          tenantId: input.empresaId,
          rankingVersion: SEARCH_RANKING_VERSION,
          catalogVersion: versions.catalogVersion,
          queryHash,
          sort: input.sort,
          last: nextItem.cursorTuple,
        })
      : null;
    const result: SearchResult<Produto> = {
      items,
      relatedItems: [],
      groups: { primary: items, related: [] },
      total: pageResult.total,
      relatedTotal: 0,
      page: input.page,
      limit: input.limit,
      totalPages: pageResult.totalPages,
      nextCursor,
      searchId: crypto.randomUUID(),
      rankingVersion: SEARCH_RANKING_VERSION,
      mode: 'advanced',
      query: input.term,
      interpretedQuery: intent,
      timing: {
        parseTimeMs,
        databaseTimeMs: (cached.status === 'hit' ? 0 : plan.databaseTimeMs) + hydrationTimeMs,
        rankingTimeMs: cached.status === 'hit' ? 0 : plan.rankingTimeMs,
        totalTimeMs: Date.now() - totalStartedAt,
      },
    };
    SearchCircuitBreaker.success();
    SearchMetrics.increment('product_search_requests_total', { mode: analyticsMode, cache: cached.status });
    SearchMetrics.increment(
      'product_search_results_total',
      { group: 'primary' },
      result.groups.primary.length,
    );
    SearchMetrics.increment(
      'product_search_results_total',
      { group: 'related' },
      result.groups.related.length,
    );
    if (result.items.length === 0)
      SearchMetrics.increment('product_search_zero_results_total', { mode: analyticsMode });
    SearchMetrics.gauge('product_search_candidates', plan.candidateCount);
    SearchMetrics.gauge('product_search_relevance_results', plan.items.length, {
      relevance: 'high',
    });
    SearchMetrics.observe('product_search_duration_seconds', result.timing.totalTimeMs, {
      mode: analyticsMode,
    });
    SearchAnalyticsService.enqueue({
      searchId: result.searchId,
      empresaId: input.empresaId,
      original: input.term,
      normalized: comparable,
      intent,
      results: result.items.length,
      related: 0,
      candidates: plan.candidateCount,
      timing: result.timing,
      rankingVersion: SEARCH_RANKING_VERSION,
      mode: analyticsMode,
    });
    return { match_exato_codigo: false, ...result };
  }

  private static async productsWithImages(empresaId: number, produtoIds: number[]): Promise<Produto[]> {
    const [products, images] = await Promise.all([
      ProdutoModel.findByIdsForSite(empresaId, produtoIds),
      ProdutoModel.findImagesByProductIds(produtoIds, false),
    ]);
    const productsById = new Map(products.map((product) => [Number(product.id_produto), product]));
    return produtoIds
      .map((produtoId) => productsById.get(produtoId))
      .filter((product): product is Produto => Boolean(product))
      .map((product) => ({ ...product, imagens: images.get(Number(product.id_produto)) || [] }));
  }
}
