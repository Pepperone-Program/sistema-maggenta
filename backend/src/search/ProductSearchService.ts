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
import { SEARCH_FLAGS, SEARCH_LIMITS, SEARCH_RANKING_VERSION } from './config';
import type { Produto } from '@/types/produto';
import type { RankedSearchCandidate, SearchFilters, SearchIntent, SearchResult, SearchSort } from '@/types/search';

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

const structuredError = (code: string, message: string, statusCode: number): Error =>
  Object.assign(new Error(message), { code, statusCode });

const stableBucket = (empresaId: number, query: string): number =>
  crypto.createHash('sha256').update(`${empresaId}:${query}`).digest().readUInt32BE(0) % 100;

const schemaUnavailable = (error: unknown): boolean => {
  const message = String((error as Error)?.message || '');
  const code = String((error as { code?: string })?.code || '');
  return code === 'ER_NO_SUCH_TABLE' || /doesn't exist|product_search_|search_dictionary|search_catalog_versions/i.test(message);
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
        SearchMetrics.increment('product_search_errors_total', { code: String((error as { code?: string }).code || 'UNKNOWN') });
        if (['SEARCH_TIMEOUT', 'SEARCH_QUERY_TIMEOUT'].includes(String((error as { code?: string }).code))) SearchMetrics.increment('product_search_timeouts_total');
        SearchCircuitBreaker.failure(error);
        if (!schemaUnavailable(error)) throw error;
        console.warn('[ProductSearch] advanced schema unavailable; using legacy mode');
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
    await SearchDictionaryService.assertCatalogReady(input.empresaId);
    const versions = await SearchDictionaryService.getCatalogVersion(input.empresaId);
    const dictionary = await SearchDictionaryService.getEntries(input.empresaId, versions);
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

    const cacheKeyInput = {
      tenant: input.empresaId,
      query: comparable,
      filters: input.filters,
      cursor: input.cursor || null,
      page: input.cursor ? null : input.page,
      locale: input.locale,
      sort: input.sort,
      rankingVersion: SEARCH_RANKING_VERSION,
      catalogVersion: versions.catalogVersion,
    };
    const cached = await SearchCacheService.getOrSetResult(
      cacheKeyInput,
      async () => {
        const retrieval = await CandidateRetriever.retrieve(input.empresaId, intent, input.filters);
        const rankingStartedAt = Date.now();
        const ranked = ProductRankingEngine.rank(retrieval.candidates, intent, input.sort).filter((item) => !item.excluded);
        const rankingTimeMs = Date.now() - rankingStartedAt;
        const afterCursor = decodedCursor
          ? ranked.filter((item) => SearchCursorCodec.isAfterCursor(item, decodedCursor!.last, input.sort))
          : ranked;
        const offset = input.cursor ? 0 : (input.page - 1) * input.limit;
        const pageItems = afterCursor.slice(offset, offset + input.limit);
        const pageIds = new Set(pageItems.map((item) => item.candidate.idProduto));
        const relatedCandidates = ranked
          .filter((item) => item.group === 'RELATED' && !pageIds.has(item.candidate.idProduto))
          .slice(0, Math.min(input.limit, 10));
        const imageStartedAt = Date.now();
        const products = await this.productsWithImages([...pageItems, ...relatedCandidates]);
        const imageDatabaseTimeMs = Date.now() - imageStartedAt;
        const nextCandidate = offset + input.limit < afterCursor.length ? pageItems[pageItems.length - 1] : undefined;
        const nextCursor = nextCandidate
          ? SearchCursorCodec.encode({
              tenantId: input.empresaId,
              rankingVersion: SEARCH_RANKING_VERSION,
              catalogVersion: versions.catalogVersion,
              queryHash,
              sort: input.sort,
              last: SearchCursorCodec.tuple(nextCandidate),
            })
          : null;
        const productsById = new Map(products.map((item) => [item.ranked.candidate.idProduto, item.product]));
        const pageProducts = pageItems.map((item) => ({ ranked: item, product: productsById.get(item.candidate.idProduto)! }));
        const primary = pageProducts.filter((item) => item.ranked.group === 'PRIMARY').map((item) => item.product);
        const related = [
          ...pageProducts.filter((item) => item.ranked.group === 'RELATED').map((item) => item.product),
          ...relatedCandidates.map((item) => productsById.get(item.candidate.idProduto)!),
        ];
        const allProducts = pageProducts.map((item) => item.product);
        const primaryTotal = ranked.filter((item) => item.group === 'PRIMARY').length;
        const relatedTotal = ranked.length - primaryTotal;
        const result: SearchResult<Produto> = {
          items: allProducts,
          relatedItems: related,
          groups: { primary, related },
          total: ranked.length,
          relatedTotal,
          page: input.page,
          limit: input.limit,
          totalPages: Math.ceil(ranked.length / input.limit),
          nextCursor,
          searchId: crypto.randomUUID(),
          rankingVersion: SEARCH_RANKING_VERSION,
          mode: 'advanced',
          query: input.term,
          interpretedQuery: intent,
          timing: {
            parseTimeMs,
            databaseTimeMs: retrieval.databaseTimeMs + imageDatabaseTimeMs,
            rankingTimeMs,
            totalTimeMs: Date.now() - totalStartedAt,
          },
        };
        return { result, candidateCount: retrieval.candidates.length };
      }
    );
    const result = {
      ...cached.value.result,
      searchId: crypto.randomUUID(),
      query: input.term,
      timing: cached.status === 'hit'
        ? { parseTimeMs, databaseTimeMs: 0, rankingTimeMs: 0, totalTimeMs: Date.now() - totalStartedAt }
        : { ...cached.value.result.timing, totalTimeMs: Date.now() - totalStartedAt },
    };
    SearchCircuitBreaker.success();
    SearchMetrics.increment('product_search_requests_total', { mode: analyticsMode, cache: cached.status });
    SearchMetrics.increment('product_search_results_total', { group: 'primary' }, result.groups.primary.length);
    SearchMetrics.increment('product_search_results_total', { group: 'related' }, result.groups.related.length);
    if (result.items.length === 0) SearchMetrics.increment('product_search_zero_results_total', { mode: analyticsMode });
    SearchMetrics.gauge('product_search_candidates', cached.value.candidateCount);
    SearchMetrics.observe('product_search_duration_seconds', result.timing.totalTimeMs, { mode: analyticsMode });
    SearchAnalyticsService.enqueue({
      searchId: result.searchId,
      empresaId: input.empresaId,
      original: input.term,
      normalized: comparable,
      intent,
      results: result.groups.primary.length,
      related: result.groups.related.length,
      candidates: cached.value.candidateCount,
      timing: result.timing,
      rankingVersion: SEARCH_RANKING_VERSION,
      mode: analyticsMode,
    });
    return { match_exato_codigo: false, ...result };
  }

  private static async legacy(input: SearchInput): Promise<ProductSearchResponse> {
    const startedAt = Date.now();
    const normalized = QueryNormalizer.normalize(input.term);
    const { items, total } = await ProdutoModel.searchForSite(input.empresaId, input.term.trim(), input.page, input.limit);
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

  private static async productsWithImages(
    ranked: RankedSearchCandidate[]
  ): Promise<Array<{ ranked: RankedSearchCandidate; product: Produto }>> {
    const images = await ProdutoModel.findImagesByProductIds(ranked.map((item) => item.candidate.idProduto), false);
    return ranked.map((item) => ({
      ranked: item,
      product: {
        ...item.candidate.rawProduct,
        imagens: images.get(item.candidate.idProduto) || [],
      },
    }));
  }
}
