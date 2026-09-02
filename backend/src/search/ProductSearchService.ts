import crypto from 'crypto';
import { ProdutoModel } from '@models/Produto';
import { TipoProdutoModel } from '@models/TipoProduto';
import { CandidateRetriever } from './CandidateRetriever';
import { ProductRankingEngine } from './ProductRankingEngine';
import { legacySearchTerms, QueryNormalizer } from './QueryNormalizer';
import { QueryParser } from './QueryParser';
import { SearchAnalyticsService } from './SearchAnalyticsService';
import { SearchCircuitBreaker } from './SearchCircuitBreaker';
import { SearchCursorCodec } from './SearchCursorCodec';
import { SearchDictionaryService } from './SearchDictionaryService';
import { SearchMetrics } from './SearchMetrics';
import { SearchCacheService } from './SearchCacheService';
import { SearchConcurrencyLimiter } from './SearchConcurrencyLimiter';
import { SEARCH_FLAGS, SEARCH_LIMITS, SEARCH_RANKING_VERSION } from './config';
import type { Produto } from '@/types/produto';
import type { SearchCursor, SearchFilters, SearchIntent, SearchResult, SearchSort } from '@/types/search';

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
  high: RankingPlanItem[];
  relatedTotal: number;
  candidateCount: number;
  databaseTimeMs: number;
  rankingTimeMs: number;
};

export const paginateRankingItems = (
  items: RankingPlanItem[],
  page: number,
  limit: number,
  cursor: SearchCursor['last'] | null,
  sort: SearchSort
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

const stableBucket = (empresaId: number, query: string): number =>
  crypto.createHash('sha256').update(`${empresaId}:${query}`).digest().readUInt32BE(0) % 100;

const schemaUnavailable = (error: unknown): boolean => {
  const message = String((error as Error)?.message || '');
  const code = String((error as { code?: string })?.code || '');
  return code === 'ER_NO_SUCH_TABLE' || /doesn't exist|product_search_|search_dictionary|search_catalog_versions/i.test(message);
};

const ADVANCED_FALLBACK_CODES = new Set([
  'SEARCH_CATALOG_NOT_READY',
  'SEARCH_TIMEOUT',
  'SEARCH_QUERY_TIMEOUT',
  'SEARCH_SATURATED',
  'SEARCH_CURSOR_SECRET_NOT_CONFIGURED',
]);

export const shouldFallbackToLegacySearch = (error: unknown): boolean => {
  const code = String((error as { code?: string })?.code || '');
  return ADVANCED_FALLBACK_CODES.has(code) || schemaUnavailable(error);
};

const withTimeout = async <T>(operation: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(structuredError('SEARCH_TIMEOUT', 'A busca excedeu o tempo limite', 503)),
          SEARCH_LIMITS.applicationTimeoutMs
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

    const suffixMatch = await ProdutoModel.findByExactCodeForSite(input.empresaId, `${term}C`);
    const exactMatch = suffixMatch || await ProdutoModel.findByExactCodeForSite(input.empresaId, term);
    if (exactMatch) return { match_exato_codigo: true, id_produto: exactMatch.id_produto, codigo: exactMatch.codigo };

    const normalized = QueryNormalizer.normalize(term);
    const bucket = stableBucket(input.empresaId, normalized.comparable);
    const advanced = input.forceAdvanced || bucket < SEARCH_FLAGS.rankingPercentage;
    const shadow = !advanced && bucket < SEARCH_FLAGS.shadowPercentage;

    if (advanced && !SearchCircuitBreaker.isOpen()) {
      try {
        return await withTimeout(SearchConcurrencyLimiter.run(() => this.advanced(input, normalized.comparable)));
      } catch (error) {
        const code = String((error as { code?: string }).code || 'UNKNOWN');
        SearchMetrics.increment('product_search_errors_total', { code });
        if (['SEARCH_TIMEOUT', 'SEARCH_QUERY_TIMEOUT'].includes(code)) SearchMetrics.increment('product_search_timeouts_total');
        SearchCircuitBreaker.failure(error);
        if (!shouldFallbackToLegacySearch(error)) throw error;
        SearchMetrics.increment('product_search_legacy_fallback_total', { code });
        console.warn('[ProductSearch] advanced search unavailable; using legacy mode', {
          code,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (advanced && SearchCircuitBreaker.isOpen()) {
      SearchMetrics.increment('product_search_circuit_breaker_fallback_total');
      SearchMetrics.gauge('product_search_circuit_breaker_open', 1);
    } else {
      SearchMetrics.gauge('product_search_circuit_breaker_open', 0);
    }

    const legacy = await this.legacy(input);
    if (shadow && !SearchCircuitBreaker.isOpen()) {
      void withTimeout(SearchConcurrencyLimiter.run(() => this.advanced(input, normalized.comparable, 'shadow'))).then((shadowResult) => {
        if (legacy.match_exato_codigo || shadowResult.match_exato_codigo) return;
        const legacyTop = new Set(legacy.items.slice(0, 10).map((item) => item.codigo));
        const shadowTop = shadowResult.items.slice(0, 10).map((item) => item.codigo);
        const overlap = shadowTop.filter((code) => legacyTop.has(code)).length / Math.max(shadowTop.length, 1);
        SearchMetrics.gauge('product_search_shadow_top10_overlap_ratio', overlap);
        console.log(JSON.stringify({ event: 'product_search_shadow', queryHash: SearchCursorCodec.queryHash(normalized.comparable), overlapTop10: overlap }));
      }).catch((error) => {
          SearchCircuitBreaker.failure(error);
          console.warn('[ProductSearch] shadow execution failed', {
            code: (error as { code?: string }).code,
            message: error instanceof Error ? error.message : String(error),
          });
        });
    }
    return legacy;
  }

  private static async advanced(
    input: SearchInput,
    comparable: string,
    analyticsMode: 'advanced' | 'shadow' = 'advanced'
  ): Promise<ProductSearchResponse> {
    const totalStartedAt = Date.now();
    const parseStartedAt = Date.now();
    const { versions, dictionary } = await SearchDictionaryService.prepareCatalog(input.empresaId);
    const normalized = QueryNormalizer.normalize(input.term);
    const intent = QueryParser.parse(normalized, dictionary);
    const parseTimeMs = Date.now() - parseStartedAt;
    const queryHash = SearchCursorCodec.queryHash(comparable);
    let decodedCursor = input.cursor ? SearchCursorCodec.decode(input.cursor) : null;
    if (decodedCursor && (
      decodedCursor.tenantId !== input.empresaId
      || decodedCursor.catalogVersion !== versions.catalogVersion
      || decodedCursor.rankingVersion !== SEARCH_RANKING_VERSION
      || decodedCursor.queryHash !== queryHash
      || decodedCursor.sort !== input.sort
    )) {
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
      const ranked = ProductRankingEngine.rank(retrieval.candidates, intent, input.sort)
        .filter((item) => !item.excluded);
      const compact = (item: typeof ranked[number]): RankingPlanItem => ({
        idProduto: item.candidate.idProduto,
        group: item.group,
        relevance: item.relevance,
        cursorTuple: SearchCursorCodec.tuple(item),
      });
      return {
        high: ranked.filter((item) => item.relevance === 'HIGH').map(compact),
        relatedTotal: ranked.filter((item) => item.relevance !== 'HIGH').length,
        candidateCount: retrieval.candidates.length,
        databaseTimeMs: retrieval.databaseTimeMs,
        rankingTimeMs: Date.now() - rankingStartedAt,
      };
    });
    const plan = cached.value;
    const pageResult = paginateRankingItems(
      plan.high,
      input.page,
      input.limit,
      decodedCursor?.last || null,
      input.sort
    );
    const pageItems = pageResult.items;
    const hydrationStartedAt = Date.now();
    const hydrated = await this.productsWithImages(
      input.empresaId,
      pageItems.map((item) => item.idProduto)
    );
    const hydrationTimeMs = Date.now() - hydrationStartedAt;
    const productsById = new Map(hydrated.map((product) => [Number(product.id_produto), product]));
    const items = pageItems.map((item) => productsById.get(item.idProduto)).filter((item): item is Produto => Boolean(item));
    const nextItem = pageResult.hasNext ? pageItems[pageItems.length - 1] : undefined;
    const nextCursor = nextItem ? SearchCursorCodec.encode({
      tenantId: input.empresaId,
      rankingVersion: SEARCH_RANKING_VERSION,
      catalogVersion: versions.catalogVersion,
      queryHash,
      sort: input.sort,
      last: nextItem.cursorTuple,
    }) : null;
    const result: SearchResult<Produto> = {
      items,
      relatedItems: [],
      groups: { primary: items, related: [] },
      total: pageResult.total,
      relatedTotal: plan.relatedTotal,
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
    SearchMetrics.increment('product_search_results_total', { group: 'primary' }, result.groups.primary.length);
    SearchMetrics.increment('product_search_results_total', { group: 'related' }, result.groups.related.length);
    if (result.items.length === 0) SearchMetrics.increment('product_search_zero_results_total', { mode: analyticsMode });
    SearchMetrics.gauge('product_search_candidates', plan.candidateCount);
    SearchMetrics.gauge('product_search_relevance_results', plan.high.length, { relevance: 'high' });
    SearchMetrics.gauge('product_search_relevance_results', plan.relatedTotal, { relevance: 'excluded' });
    SearchMetrics.observe('product_search_duration_seconds', result.timing.totalTimeMs, { mode: analyticsMode });
    SearchAnalyticsService.enqueue({
      searchId: result.searchId,
      empresaId: input.empresaId,
      original: input.term,
      normalized: comparable,
      intent,
      results: result.groups.primary.length,
      related: result.groups.related.length,
      candidates: plan.candidateCount,
      timing: result.timing,
      rankingVersion: SEARCH_RANKING_VERSION,
      mode: analyticsMode,
    });
    return { match_exato_codigo: false, ...result };
  }

  private static async legacy(input: SearchInput): Promise<ProductSearchResponse> {
    const startedAt = Date.now();
    const normalized = QueryNormalizer.normalize(input.term);
    const matchingTypes = await TipoProdutoModel.findSearchCandidates(input.empresaId, input.term.trim(), 2);
    const exactType = matchingTypes.length === 1 ? Number(matchingTypes[0].id_tipo_produto) : undefined;
    const { items, total } = await ProdutoModel.searchForSite(
      input.empresaId,
      input.term.trim(),
      input.page,
      input.limit,
      legacySearchTerms(normalized.tokens),
      exactType
    );
    const images = await ProdutoModel.findImagesByProductIds(items.map((item) => Number(item.id_produto)), false);
    const hydrated = items.map((item) => ({ ...item, imagens: images.get(Number(item.id_produto)) || [] }));
    const emptyIntent: SearchIntent = {
      original: normalized.original,
      normalized: normalized.normalized,
      comparable: normalized.comparable,
      attributes: [],
      materials: [],
      colors: [],
      measurements: {},
      constraints: [],
      positiveTerms: normalized.tokens,
      negativeTerms: [],
      phrases: [],
      synonyms: [],
      unknownTerms: normalized.tokens,
      safeBooleanQuery: '',
      relaxedBooleanQuery: '',
    };
    const elapsed = Date.now() - startedAt;
    SearchMetrics.increment('product_search_requests_total', { mode: 'legacy', cache: 'none' });
    if (total === 0) SearchMetrics.increment('product_search_zero_results_total', { mode: 'legacy' });
    SearchMetrics.observe('product_search_duration_seconds', elapsed, { mode: 'legacy' });
    return {
      match_exato_codigo: false,
      items: hydrated,
      relatedItems: [],
      groups: { primary: hydrated, related: [] },
      total,
      relatedTotal: 0,
      page: input.page,
      limit: input.limit,
      totalPages: Math.ceil(total / input.limit),
      nextCursor: null,
      searchId: crypto.randomUUID(),
      rankingVersion: 'legacy',
      mode: 'legacy',
      query: input.term,
      interpretedQuery: emptyIntent,
      timing: { parseTimeMs: 0, databaseTimeMs: elapsed, rankingTimeMs: 0, totalTimeMs: elapsed },
    };
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
