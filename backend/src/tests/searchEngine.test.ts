import '../module-alias';
import assert from 'node:assert/strict';
import { ProductRankingEngine } from '@search/ProductRankingEngine';
import { QueryNormalizer } from '@search/QueryNormalizer';
import { QueryParser } from '@search/QueryParser';
import { QueryTokenizer } from '@search/QueryTokenizer';
import { SearchCursorCodec } from '@search/SearchCursorCodec';
import { SearchCacheService } from '@search/SearchCacheService';
import { SearchDictionaryService } from '@search/SearchDictionaryService';
import { SearchAnalyticsService } from '@search/SearchAnalyticsService';
import { SearchCircuitBreaker } from '@search/SearchCircuitBreaker';
import { CandidateRetriever } from '@search/CandidateRetriever';
import {
  paginateRankingItems,
  ProductSearchService,
  type RankingPlanItem,
} from '@search/ProductSearchService';
import { ProdutoModel } from '@models/Produto';
import type { SearchCandidate, SearchDictionaryEntry, SearchSort } from '@/types/search';

const candidate = (overrides: Partial<SearchCandidate> = {}): SearchCandidate => ({
  rawProduct: {} as SearchCandidate['rawProduct'],
  idEmpresa: 1,
  idProduto: 100,
  idTipoProduto: 10,
  produto: 'Garrafa termica inox 500ml',
  normalizedName: 'garrafa termica inox 500ml',
  descricao: null,
  searchText: 'garrafa termica inox 500ml',
  codigo: 'GAR500',
  imagem: null,
  altura: null,
  largura: null,
  profundidade: null,
  peso: null,
  ncm: null,
  quantidadeMinima: 10,
  dataInclusao: '2026-01-01',
  obs: null,
  lancamento: 'N',
  promocao: 'N',
  premium: 'N',
  popularidade: 10,
  fulltextNameScore: 2,
  fulltextTextScore: 1,
  containsTypeIds: [],
  colors: [],
  attributes: [
    {
      attributeId: 20,
      attributeKey: 'double_wall',
      semanticType: 'ATTRIBUTE',
      optionId: 21,
      optionKey: 'yes',
      canonicalValue: 'parede dupla',
      booleanValue: true,
      numberValue: null,
      textValue: null,
      unit: null,
      conflictingOptionIds: [],
    },
    {
      attributeId: 40,
      attributeKey: 'material',
      semanticType: 'MATERIAL',
      optionId: 41,
      optionKey: 'inox',
      canonicalValue: 'material',
      booleanValue: null,
      numberValue: null,
      textValue: null,
      unit: null,
      conflictingOptionIds: [],
    },
    {
      attributeId: 50,
      attributeKey: 'capacity_ml',
      semanticType: 'MEASUREMENT',
      optionId: null,
      optionKey: null,
      canonicalValue: null,
      booleanValue: null,
      numberValue: 500,
      textValue: null,
      unit: 'ml',
      conflictingOptionIds: [],
    },
  ],
  ...overrides,
});
const parse = (text: string) => QueryParser.parse(QueryNormalizer.normalize(text));
const product = (id: number, title: string, text = title, overrides: Partial<SearchCandidate> = {}) =>
  candidate({
    idProduto: id,
    normalizedName: title,
    produto: title,
    searchText: text,
    ...overrides,
  });
const dict = [
  {
    normalizedTerm: 'case',
    termType: 'PRODUCT_TYPE',
    canonicalValue: 'case',
    productTypeId: 10,
  },
  {
    normalizedTerm: 'termica',
    termType: 'SYNONYM',
    canonicalValue: 'parede dupla',
  },
] as SearchDictionaryEntry[];
assert.deepEqual(QueryParser.parse(QueryNormalizer.normalize('cafe'), dict).positiveTerms, ['cafe']);
assert.deepEqual(QueryParser.parse(QueryNormalizer.normalize('termica'), dict).positiveTerms, ['termica']);
assert.equal(parse('caneca cafe').safeBooleanQuery, '+caneca* +cafe*');
assert.equal(parse('CAF\u00c9').safeBooleanQuery, parse('cafe').safeBooleanQuery);
assert.equal(parse('A5 UV').safeBooleanQuery, '+a5* +uv*');
assert.equal(parse('cafffe').safeBooleanQuery, '+cafffe*');
assert.throws(() => parse('com para'), { code: 'NO_SEARCHABLE_TERMS' });
assert.throws(() => parse('***'), { code: 'NO_SEARCHABLE_TERMS' });
assert.equal(QueryTokenizer.buildSafeBooleanQuery(['garrafa', "+'--", 'inox']), 'garrafa* inox*');
assert.throws(() => parse(Array.from({ length: 21 }, (_, index) => 'termo' + index).join(' ')), /20 termos/);
const cafe = parse('cafe');
assert.equal(ProductRankingEngine.rankCandidate(product(1, 'case'), cafe).lexical.matchedTerms.length, 0);
assert.equal(
  ProductRankingEngine.rankCandidate(product(1, 'descafeinado'), cafe).lexical.matchedTerms.length,
  0,
);
assert.equal(ProductRankingEngine.rankCandidate(product(1, 'cafeteira'), cafe).lexical.complete, true);
assert.deepEqual(
  ProductRankingEngine.rankCandidate(product(1, 'case', 'case para cafe'), cafe).lexical.documentOnlyTerms,
  ['cafe'],
);
const candidates = [
  product(1, 'case', 'case cafe', { popularidade: 100000 }),
  product(2, 'cafeteira'),
  product(3, 'kit cafe'),
  product(4, 'cafe'),
];
assert.deepEqual(
  ProductRankingEngine.rank(candidates, cafe).map((item) => item.candidate.idProduto),
  [4, 3, 2, 1],
);
const multi = parse('caneca cafe');
const pool = [
  product(1, 'caneca'),
  product(2, 'kit cafe'),
  product(3, 'caneca cafe'),
  product(4, 'cafe caneca'),
  product(5, 'caneca', 'caneca cafe'),
];
const ranked = ProductRankingEngine.rank(pool, multi);
assert.deepEqual(
  ranked.map((item) => item.candidate.idProduto),
  [3, 4, 5],
);
assert.equal(
  ranked.every((item) => item.relevance === 'HIGH'),
  true,
);
const barbecue = parse('kit churrasco');
const barbecueResults = ProductRankingEngine.rank(
  [
    product(11, 'kit churrasco'),
    product(12, 'kit executivo'),
    product(13, 'kit cafe'),
    product(14, 'estojo', 'estojo para kit de churrasco'),
  ],
  barbecue,
);
assert.deepEqual(
  barbecueResults.map((item) => item.candidate.idProduto),
  [11, 14],
  'products matching only kit must be excluded before pagination',
);
assert.equal(
  ProductRankingEngine.rankCandidate(product(1, 'caneca cafe', 'caneca cafe', { idTipoProduto: 999 }), multi)
    .relevance,
  'HIGH',
);
for (const sort of ['relevance', 'newest', 'popular'] as SearchSort[]) {
  const items = ProductRankingEngine.rank(
    pool.map((p, i) => ({
      ...p,
      popularidade: 100 - i,
      dataInclusao: '2026-01-0' + (i + 1),
    })),
    multi,
    sort,
  );
  const plans: RankingPlanItem[] = items.map((item) => ({
    idProduto: item.candidate.idProduto,
    group: item.group,
    relevance: item.relevance,
    cursorTuple: SearchCursorCodec.tuple(item),
  }));
  const seen: number[] = [];
  let last = null as RankingPlanItem['cursorTuple'] | null;
  do {
    const page = paginateRankingItems(plans, 1, 2, last, sort);
    seen.push(...page.items.map((item) => item.idProduto));
    if (!page.hasNext) break;
    last = page.items[page.items.length - 1].cursorTuple;
  } while (true);
  assert.deepEqual(
    seen,
    items.map((item) => item.candidate.idProduto),
  );
  assert.equal(
    items.slice(0, 3).every((item) => item.lexical.complete),
    true,
  );
}
const many = ProductRankingEngine.rank(
  Array.from({ length: 1500 }, (_, i) => product(i + 1, 'cafe')),
  cafe,
);
const manyPlan = many.map((item) => ({
  idProduto: item.candidate.idProduto,
  group: item.group,
  relevance: item.relevance,
  cursorTuple: SearchCursorCodec.tuple(item),
}));
assert.equal(paginateRankingItems(manyPlan, 63, 24, null, 'relevance').items.length, 12);
assert.equal(
  SearchCacheService.resultKey({
    filters: { color: 'azul', material: 'inox' },
  }),
  SearchCacheService.resultKey({
    filters: { material: 'inox', color: 'azul' },
  }),
);

const verifyService = async () => {
  process.env.UPSTASH_REDIS_REST_URL = '';
  process.env.UPSTASH_REDIS_REST_TOKEN = '';
  const originals = {
    exact: ProdutoModel.findByExactCodeForSite,
    legacy: ProdutoModel.searchForSite,
    ready: SearchDictionaryService.assertCatalogReady,
    version: SearchDictionaryService.getCatalogVersion,
    retrieve: CandidateRetriever.retrieve,
    hydrate: ProdutoModel.findByIdsForSite,
    images: ProdutoModel.findImagesByProductIds,
    analytics: SearchAnalyticsService.enqueue,
  };
  try {
    const lookups: string[] = [];
    ProdutoModel.findByExactCodeForSite = async (_tenant, code) => {
      lookups.push(code);
      return code === 'BT256C' ? { id_produto: 99, codigo: code } : null;
    };
    ProdutoModel.searchForSite = async () => {
      throw new Error('Legacy must never execute');
    };
    SearchDictionaryService.assertCatalogReady = async () => {};
    SearchDictionaryService.getCatalogVersion = async () => ({
      catalogVersion: 987,
      dictionaryVersion: 1,
    });
    CandidateRetriever.retrieve = async () => ({
      candidates: pool,
      databaseTimeMs: 0,
    });
    ProdutoModel.findByIdsForSite = async (_tenant, ids) =>
      ids.map(
        (id) =>
          ({
            id_produto: id,
            codigo: 'P' + id,
          }) as SearchCandidate['rawProduct'],
      );
    ProdutoModel.findImagesByProductIds = async () => new Map();
    SearchAnalyticsService.enqueue = () => {};
    const input = {
      empresaId: 1,
      term: 'caneca cafe',
      page: 1,
      limit: 2,
      filters: {},
      locale: 'pt-BR',
      sort: 'relevance' as const,
    };
    assert.equal((await ProductSearchService.search({ ...input, term: 'BT256' })).match_exato_codigo, true);
    assert.deepEqual(lookups, ['BT256C']);
    const first = await ProductSearchService.search(input);
    assert.equal(first.match_exato_codigo, false);
    if (first.match_exato_codigo) throw new Error('unexpected code');
    assert.equal(first.total, 3);
    assert.equal(first.relatedTotal, 0);
    assert.equal(first.totalPages, 2);
    assert.deepEqual(
      first.items.map((p) => p.id_produto),
      [3, 4],
    );
    const next = await ProductSearchService.search({
      ...input,
      cursor: first.nextCursor!,
    });
    if (next.match_exato_codigo) throw new Error('unexpected code');
    assert.deepEqual(
      next.items.map((p) => p.id_produto),
      [5],
    );
    assert.deepEqual(
      next.groups.primary.map((p) => p.id_produto),
      [5],
    );
    assert.deepEqual(
      next.relatedItems.map((p) => p.id_produto),
      [],
    );
    assert.deepEqual(next.groups.related, []);
    assert.equal(next.nextCursor, null);
    for (const changed of [
      { filters: { color: 'red' } },
      { empresaId: 2 },
      { sort: 'popular' as const },
      { term: 'cafe' },
      { locale: 'en' },
    ]) {
      await assert.rejects(
        ProductSearchService.search({
          ...input,
          ...changed,
          cursor: first.nextCursor!,
        }),
        {
          code: 'INVALID_SEARCH_CURSOR',
        },
      );
    }
    await assert.rejects(ProductSearchService.search({ ...input, cursor: first.nextCursor + 'x' }), {
      code: 'INVALID_SEARCH_CURSOR',
    });
    SearchDictionaryService.getCatalogVersion = async () => ({
      catalogVersion: 988,
      dictionaryVersion: 1,
    });
    await assert.rejects(ProductSearchService.search({ ...input, cursor: first.nextCursor! }), {
      code: 'INVALID_SEARCH_CURSOR',
    });
    const decoded = SearchCursorCodec.decode(first.nextCursor!);
    const oldVersion = SearchCursorCodec.encode({
      ...decoded,
      rankingVersion: 'v4',
    });
    await assert.rejects(ProductSearchService.search({ ...input, cursor: oldVersion }), {
      code: 'INVALID_SEARCH_CURSOR',
    });
    const expired = SearchCursorCodec.encode(decoded, -1);
    assert.throws(() => SearchCursorCodec.decode(expired), {
      code: 'INVALID_SEARCH_CURSOR',
    });
    for (const code of ['SEARCH_CATALOG_NOT_READY', 'SEARCH_TIMEOUT', 'SEARCH_SATURATED', 'DB_QUERY_ERROR']) {
      SearchCircuitBreaker.success();
      SearchDictionaryService.assertCatalogReady = async () => {
        throw Object.assign(new Error(code), { code, statusCode: 503 });
      };
      await assert.rejects(ProductSearchService.search(input), {
        code: 'SEARCH_UNAVAILABLE',
        statusCode: 503,
      });
    }
    SearchCircuitBreaker.success();
    ProdutoModel.findByExactCodeForSite = async () => {
      throw Object.assign(new Error('connection failed'), {
        code: 'DB_UNREACHABLE',
      });
    };
    await assert.rejects(ProductSearchService.search(input), {
      code: 'SEARCH_UNAVAILABLE',
      statusCode: 503,
    });
  } finally {
    ProdutoModel.findByExactCodeForSite = originals.exact;
    ProdutoModel.searchForSite = originals.legacy;
    SearchDictionaryService.assertCatalogReady = originals.ready;
    SearchDictionaryService.getCatalogVersion = originals.version;
    CandidateRetriever.retrieve = originals.retrieve;
    ProdutoModel.findByIdsForSite = originals.hydrate;
    ProdutoModel.findImagesByProductIds = originals.images;
    SearchAnalyticsService.enqueue = originals.analytics;
    SearchCircuitBreaker.success();
  }
};
void verifyService()
  .then(() => console.log('searchEngine.test: lexical ranking, groups, cursor and unavailable contract ok'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
