import '../module-alias';
import assert from 'node:assert/strict';
import { ProductRankingEngine } from '@search/ProductRankingEngine';
import { legacySearchTerms, QueryNormalizer } from '@search/QueryNormalizer';
import { QueryParser } from '@search/QueryParser';
import { QueryTokenizer } from '@search/QueryTokenizer';
import { SearchCursorCodec } from '@search/SearchCursorCodec';
import { SearchCacheService } from '@search/SearchCacheService';
import { SearchDictionaryService } from '@search/SearchDictionaryService';
import {
  paginateRankingItems,
  ProductSearchService,
  shouldFallbackToLegacySearch,
  type RankingPlanItem,
} from '@search/ProductSearchService';
import { ProdutoModel } from '@models/Produto';
import { TipoProdutoModel } from '@models/TipoProduto';
import type { SearchCandidate, SearchDictionaryEntry } from '@/types/search';

const entry = (partial: Partial<SearchDictionaryEntry> & Pick<SearchDictionaryEntry, 'normalizedTerm' | 'termType' | 'canonicalValue'>): SearchDictionaryEntry => ({
  id: partial.id || 1,
  idEmpresa: 1,
  term: partial.normalizedTerm,
  relationType: partial.relationType || 'EXACT_SYNONYM',
  productTypeId: partial.productTypeId || null,
  attributeId: partial.attributeId || null,
  optionId: partial.optionId || null,
  priority: partial.priority || 100,
  confidence: partial.confidence || 1,
  tokenCount: partial.normalizedTerm.split(' ').length,
  ...partial,
});

const dictionary: SearchDictionaryEntry[] = [
  entry({ id: 1, normalizedTerm: 'garrafa', termType: 'PRODUCT_TYPE', canonicalValue: 'garrafa', productTypeId: 10 }),
  entry({ id: 2, normalizedTerm: 'parede dupla', termType: 'ATTRIBUTE', canonicalValue: 'double_wall', attributeId: 20, optionId: 21 }),
  entry({ id: 3, normalizedTerm: 'sem pauta', termType: 'NEGATION', canonicalValue: 'lined', attributeId: 30, optionId: 32 }),
  entry({ id: 4, normalizedTerm: 'pauta', termType: 'ATTRIBUTE', canonicalValue: 'lined', attributeId: 30, optionId: 31 }),
  entry({ id: 5, normalizedTerm: 'inox', termType: 'MATERIAL', canonicalValue: 'material', attributeId: 40, optionId: 41 }),
  entry({ id: 6, normalizedTerm: 'termica', termType: 'SYNONYM', canonicalValue: 'parede dupla' }),
  entry({ id: 7, normalizedTerm: 'capacidade', termType: 'ATTRIBUTE', canonicalValue: 'capacity_ml', attributeId: 50, priority: 1 }),
];

const penDictionary: SearchDictionaryEntry[] = [
  entry({ id: 101, normalizedTerm: 'caneta plastica', termType: 'PRODUCT_TYPE', canonicalValue: 'caneta plastica', productTypeId: 11 }),
  entry({ id: 102, normalizedTerm: 'caneta metal', termType: 'PRODUCT_TYPE', canonicalValue: 'caneta metal', productTypeId: 12 }),
  entry({ id: 103, normalizedTerm: 'manta', termType: 'PRODUCT_TYPE', canonicalValue: 'manta', productTypeId: 337 }),
];

const candidate = (overrides: Partial<SearchCandidate> = {}): SearchCandidate => ({
  rawProduct: {} as SearchCandidate['rawProduct'], idEmpresa: 1, idProduto: 100, idTipoProduto: 10,
  produto: 'Garrafa termica inox 500ml', normalizedName: 'garrafa termica inox 500ml', descricao: null,
  codigo: 'GAR500', imagem: null, altura: null, largura: null, profundidade: null, peso: null, ncm: null,
  quantidadeMinima: 10, dataInclusao: '2026-01-01', obs: null, lancamento: 'N', promocao: 'N', premium: 'N',
  popularidade: 10, fulltextNameScore: 2, fulltextTextScore: 1, containsTypeIds: [], colors: [],
  attributes: [
    { attributeId: 20, attributeKey: 'double_wall', semanticType: 'ATTRIBUTE', optionId: 21, optionKey: 'yes', canonicalValue: 'parede dupla', booleanValue: true, numberValue: null, textValue: null, unit: null, conflictingOptionIds: [] },
    { attributeId: 40, attributeKey: 'material', semanticType: 'MATERIAL', optionId: 41, optionKey: 'inox', canonicalValue: 'material', booleanValue: null, numberValue: null, textValue: null, unit: null, conflictingOptionIds: [] },
    { attributeId: 50, attributeKey: 'capacity_ml', semanticType: 'MEASUREMENT', optionId: null, optionKey: null, canonicalValue: null, booleanValue: null, numberValue: 500, textValue: null, unit: 'ml', conflictingOptionIds: [] },
  ],
  ...overrides,
});

const unicode = QueryNormalizer.normalize('  AÇO\u0000 INOX  ');
assert.equal(unicode.normalized, 'aço inox');
assert.equal(unicode.comparable, 'aco inox');
assert.equal(QueryNormalizer.normalize('Guarda-Chuva').comparable, 'guarda chuva');

const penIntent = QueryParser.parse(QueryNormalizer.normalize('caneta'), penDictionary);
assert.deepEqual(penIntent.positiveTerms, ['caneta'], 'token de tipo composto deve permanecer pesquisavel');
assert.deepEqual(penIntent.unknownTerms, ['caneta']);
assert.equal(penIntent.safeBooleanQuery, '+caneta*');

const correctedPenIntent = QueryParser.parse(QueryNormalizer.normalize('canetta'), penDictionary);
assert.deepEqual(correctedPenIntent.positiveTerms, ['caneta'], 'erro unico de uma edicao deve ser corrigido');
assert.equal(correctedPenIntent.safeBooleanQuery, '+caneta*');

const ambiguousTypoDictionary = [
  ...penDictionary,
  entry({ id: 104, normalizedTerm: 'canetra', termType: 'RELATED_TERM', canonicalValue: 'canetra' }),
];
const ambiguousPenIntent = QueryParser.parse(QueryNormalizer.normalize('canetaa'), ambiguousTypoDictionary);
assert.deepEqual(ambiguousPenIntent.positiveTerms, ['canetaa'], 'correcao ambigua deve preservar o termo original');

const unrelatedBlanket = ProductRankingEngine.rankCandidate(candidate({
  idTipoProduto: 337,
  produto: 'Manta Cobertor Personalizada',
  normalizedName: 'manta cobertor personalizada',
  descricao: 'manta em tecido polar',
  fulltextNameScore: 0,
  fulltextTextScore: 0,
}), penIntent);
assert.notEqual(unrelatedBlanket.relevance, 'HIGH', 'manta nao pode ter alta relevancia para caneta');

const phraseIntent = QueryParser.parse(QueryNormalizer.normalize('bloco sem pauta'), dictionary);
assert.equal(phraseIntent.constraints.length, 1, 'a frase longa deve impedir o rematch isolado de pauta');
assert.equal(phraseIntent.constraints[0].explicitNegation, true);
assert.equal(phraseIntent.constraints[0].strength, 'HARD');
assert.equal(phraseIntent.positiveTerms.includes('sem'), true);
assert.equal(phraseIntent.positiveTerms.includes('pauta'), true);

const doubleWallIntent = QueryParser.parse(QueryNormalizer.normalize('garrafa parede dupla'), dictionary);
assert.deepEqual(legacySearchTerms(QueryNormalizer.normalize('garrafa com parede dupla').tokens), ['garrafa', 'parede', 'dupla']);
assert.deepEqual(new Set(doubleWallIntent.positiveTerms), new Set(['garrafa', 'parede', 'dupla']));
assert.equal(doubleWallIntent.safeBooleanQuery.split(' ').every((token) => token.startsWith('+')), true);
assert.equal(doubleWallIntent.safeBooleanQuery.includes('+garrafa*'), true);
assert.equal(doubleWallIntent.safeBooleanQuery.includes('+parede*'), true);
assert.equal(doubleWallIntent.safeBooleanQuery.includes('+dupla*'), true);

const intent = QueryParser.parse(QueryNormalizer.normalize('garrafa térmica inox 500ml'), dictionary);
assert.equal(intent.productType?.id, 10);
assert.equal(intent.measurements.capacityMl, 500);
assert.equal(intent.constraints.find((item) => item.key === 'capacity_ml')?.attributeId, 50);
assert.equal(intent.positiveTerms.includes('parede'), true, 'sinonimo composto deve ser separado em tokens');
assert.equal(intent.positiveTerms.includes('dupla'), true, 'sinonimo composto deve ser separado em tokens');
assert.equal(intent.positiveTerms.includes('parededupla'), false);
assert.equal(intent.positiveTerms.includes('inox'), true, 'material reconhecido tambem deve participar da recuperacao lexical');
assert.equal(intent.positiveTerms.includes('500ml'), true, 'medida deve participar da recuperacao lexical quando indexavel');
const ranked = ProductRankingEngine.rankCandidate(candidate(), intent);
assert.equal(ranked.primaryTypeMatch, true);
assert.equal(ranked.excluded, false);
assert.equal(ranked.matchedConstraints >= 2, true);

const absentMetadata = ProductRankingEngine.rankCandidate(candidate({ attributes: [] }), intent);
assert.equal(absentMetadata.contradictions, 0, 'metadata ausente nao e contradicao');

const hard = ProductRankingEngine.rankCandidate(candidate({
  attributes: [{ attributeId: 30, attributeKey: 'lined', semanticType: 'ATTRIBUTE', optionId: 31, optionKey: 'yes', canonicalValue: 'com pauta', booleanValue: true, numberValue: null, textValue: null, unit: null, conflictingOptionIds: [32] }],
}), phraseIntent);
assert.equal(hard.excluded, true);
assert.equal(hard.relevance, 'LOW');

const unknownIntent = QueryParser.parse(QueryNormalizer.normalize('guarda chuva'), []);
const completeUnknown = ProductRankingEngine.rankCandidate(candidate({
  idTipoProduto: 58,
  normalizedName: 'guarda chuva personalizado',
  descricao: null,
  fulltextNameScore: 0,
  fulltextTextScore: 0,
}), unknownIntent);
const partialUnknown = ProductRankingEngine.rankCandidate(candidate({
  idTipoProduto: 58,
  normalizedName: 'capa de chuva personalizada',
  descricao: null,
  fulltextNameScore: 0,
  fulltextTextScore: 0,
}), unknownIntent);
assert.equal(completeUnknown.relevance, 'HIGH');
assert.equal(partialUnknown.relevance, 'MEDIUM');

const semanticWithMissingUnknown = QueryParser.parse(
  QueryNormalizer.normalize('garrafa parede dupla exclusiva'),
  dictionary
);
assert.deepEqual(semanticWithMissingUnknown.unknownTerms, ['exclusiva']);
const missingExplicitTerm = ProductRankingEngine.rankCandidate(candidate({
  normalizedName: 'garrafa parede dupla',
  descricao: null,
  fulltextNameScore: 0,
  fulltextTextScore: 0,
}), semanticWithMissingUnknown);
assert.equal(missingExplicitTerm.relevance, 'MEDIUM',
  'metadata estruturada nao pode ocultar a ausencia de um termo explicito');

const umbrellaDictionary = [entry({ normalizedTerm: 'guarda chuva', termType: 'PRODUCT_TYPE', canonicalValue: 'guarda chuva', productTypeId: 336 })];
const umbrellaIntent = QueryParser.parse(QueryNormalizer.normalize('guarda chuva'), umbrellaDictionary);
const umbrella = ProductRankingEngine.rankCandidate(candidate({ idTipoProduto: 336, normalizedName: 'guarda chuva automatico' }), umbrellaIntent);
const backpackMentioningUmbrella = ProductRankingEngine.rankCandidate(candidate({
  idTipoProduto: 58,
  normalizedName: 'mochila para notebook',
  descricao: 'possui bolso para guarda chuva',
}), umbrellaIntent);
const wronglyTypedParasol = ProductRankingEngine.rankCandidate(candidate({
  idTipoProduto: 336,
  normalizedName: 'guarda sol personalizado',
  descricao: 'protege do sol e da chuva',
}), umbrellaIntent);
assert.equal(umbrella.relevance, 'HIGH');
assert.equal(backpackMentioningUmbrella.relevance, 'MEDIUM');
assert.equal(wronglyTypedParasol.relevance, 'MEDIUM');

const injection = QueryTokenizer.buildSafeBooleanQuery(['garrafa', "+'--", 'inox'], true);
assert.equal(injection, '+garrafa* +inox*');
const metallic = QueryParser.parse(QueryNormalizer.normalize('garrafa metalizada'), dictionary);
assert.equal(metallic.materials.length, 0, 'metalizada nao pode inferir material metalico');

const notebookIntent = QueryParser.parse(QueryNormalizer.normalize('mochila notebook 15.6"'), dictionary);
const exactNotebook = ProductRankingEngine.rankCandidate(candidate({
  normalizedName: 'mochila para notebook 15.6"',
  descricao: 'compartimento para notebook de 15,6 polegadas',
  attributes: [],
  fulltextNameScore: 0,
  fulltextTextScore: 0,
}), notebookIntent);
const wrongSizeNotebook = ProductRankingEngine.rankCandidate(candidate({
  normalizedName: 'mochila para notebook',
  descricao: 'compartimento para notebook de 17 polegadas',
  attributes: [],
  fulltextNameScore: 0,
  fulltextTextScore: 0,
}), notebookIntent);
assert.equal(exactNotebook.score.lexicalCoverage > wrongSizeNotebook.score.lexicalCoverage, true,
  'medida textual exata deve melhorar o ranking sem virar metadata manual');

const cursor = SearchCursorCodec.encode({ tenantId: 1, rankingVersion: 'v1', catalogVersion: 2,
  queryHash: SearchCursorCodec.queryHash('garrafa'), sort: 'relevance', last: SearchCursorCodec.tuple(ranked) }, 60_000);
assert.equal(SearchCursorCodec.decode(cursor).tenantId, 1);
assert.throws(() => SearchCursorCodec.decode(`${cursor}x`), /Cursor/);

assert.throws(() => QueryNormalizer.normalize(Array.from({ length: 21 }, (_value, index) => `termo${index}`).join(' ')), /20 termos/);
assert.equal(SearchCacheService.resultKey({ tenant: 1, filters: { color: 'azul', material: 'inox' } }), SearchCacheService.resultKey({ filters: { material: 'inox', color: 'azul' }, tenant: 1 }));
assert.notEqual(SearchCacheService.resultKey({ tenant: 1, catalogVersion: 1 }), SearchCacheService.resultKey({ tenant: 1, catalogVersion: 2 }));

assert.equal(shouldFallbackToLegacySearch({ code: 'SEARCH_CATALOG_NOT_READY' }), true);
assert.equal(shouldFallbackToLegacySearch({ code: 'SEARCH_TIMEOUT' }), true);
assert.equal(shouldFallbackToLegacySearch({ code: 'SEARCH_SATURATED' }), true);
assert.equal(shouldFallbackToLegacySearch({ code: 'DB_QUERY_ERROR', message: "Table 'product_search_documents' doesn't exist" }), true);
assert.equal(shouldFallbackToLegacySearch({ code: 'INVALID_SEARCH_CURSOR' }), false);
assert.equal(shouldFallbackToLegacySearch({ code: 'DB_UNREACHABLE' }), false);

const rankingItems: RankingPlanItem[] = Array.from({ length: 1500 }, (_value, index) => ({
  idProduto: 1500 - index,
  group: 'PRIMARY',
  relevance: 'HIGH',
  cursorTuple: {
    primaryTypeMatch: 1,
    contradictions: 0,
    matchedConstraints: 0,
    group: 1,
    totalScore: 10_000 - index,
    popularity: 0,
    idProduto: 1500 - index,
    newestDate: '2026-01-01',
  },
}));
const lastSyntheticPage = paginateRankingItems(rankingItems, 63, 24, null, 'relevance');
assert.equal(lastSyntheticPage.total, 1500);
assert.equal(lastSyntheticPage.totalPages, 63);
assert.equal(lastSyntheticPage.items.length, 12);
assert.equal(lastSyntheticPage.hasNext, false);

const verifyCatalogNotReadyFallback = async (): Promise<void> => {
  const originalExactCode = ProdutoModel.findByExactCodeForSite;
  const originalSearchForSite = ProdutoModel.searchForSite;
  const originalImages = ProdutoModel.findImagesByProductIds;
  const originalTypeCandidates = TipoProdutoModel.findSearchCandidates;
  const originalPrepareCatalog = SearchDictionaryService.prepareCatalog;
  try {
    ProdutoModel.findByExactCodeForSite = async () => null;
    ProdutoModel.searchForSite = async () => ({
      items: [{ id_empresa: 1, id_produto: 1, codigo: 'CAN001', produto: 'Caneca Personalizada' } as SearchCandidate['rawProduct']],
      total: 1,
    });
    ProdutoModel.findImagesByProductIds = async () => new Map();
    TipoProdutoModel.findSearchCandidates = async () => [];
    SearchDictionaryService.prepareCatalog = async () => {
      throw Object.assign(new Error('Catalogo incompleto'), {
        code: 'SEARCH_CATALOG_NOT_READY',
        statusCode: 503,
      });
    };

    const result = await ProductSearchService.search({
      empresaId: 1,
      term: 'caneca',
      page: 1,
      limit: 20,
      sort: 'relevance',
      filters: {},
      locale: 'pt-BR',
      forceAdvanced: true,
    });
    assert.equal(result.match_exato_codigo, false);
    if (!result.match_exato_codigo) {
      assert.equal(result.mode, 'legacy');
      assert.equal(result.items[0]?.codigo, 'CAN001');
    }
  } finally {
    ProdutoModel.findByExactCodeForSite = originalExactCode;
    ProdutoModel.searchForSite = originalSearchForSite;
    ProdutoModel.findImagesByProductIds = originalImages;
    TipoProdutoModel.findSearchCandidates = originalTypeCandidates;
    SearchDictionaryService.prepareCatalog = originalPrepareCatalog;
  }
};

void verifyCatalogNotReadyFallback()
  .then(() => console.log('searchEngine.test: ok'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
