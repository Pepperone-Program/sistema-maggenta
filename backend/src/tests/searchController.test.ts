import '../module-alias';
import assert from 'node:assert/strict';
import type { Response } from 'express';
import { ProdutoController } from '@controllers/ProdutoController';
import type { AuthenticatedRequest } from '@middleware/auth';
import { ProductSearchService } from '@search/ProductSearchService';
import type { Produto } from '@/types/produto';

type SearchInput = Parameters<typeof ProductSearchService.search>[0];
type SearchResponse = Awaited<ReturnType<typeof ProductSearchService.search>>;

const originalSearch = ProductSearchService.search;
const calls: SearchInput[] = [];
let responseBody: unknown;
let responseStatus = 0;

ProductSearchService.search = async (input: SearchInput): Promise<SearchResponse> => {
  calls.push(input);
  return {
    match_exato_codigo: false,
    items: [{ id_produto: 1, codigo: 'GT03', produto: 'Garrafa parede dupla' } as Produto],
    relatedItems: [],
    groups: { primary: [], related: [] },
    total: 1,
    relatedTotal: 0,
    page: input.page,
    limit: input.limit,
    totalPages: 1,
    nextCursor: null,
    searchId: 'search-test',
    rankingVersion: 'v-test',
    mode: 'advanced',
    query: input.term,
    interpretedQuery: {
      original: input.term,
      normalized: input.term,
      comparable: input.term,
      attributes: [],
      materials: [],
      colors: [],
      measurements: {},
      constraints: [],
      positiveTerms: [],
      negativeTerms: [],
      phrases: [],
      synonyms: [],
      unknownTerms: [],
      safeBooleanQuery: '',
      relaxedBooleanQuery: '',
    },
    timing: { parseTimeMs: 0, databaseTimeMs: 0, rankingTimeMs: 0, totalTimeMs: 0 },
  };
};

const response = {
  status(status: number) {
    responseStatus = status;
    return this;
  },
  json(payload: unknown) {
    responseBody = payload;
    return this;
  },
} as unknown as Response;

const request = (query: Record<string, string>): AuthenticatedRequest => ({
  query,
  originalUrl: `/api/v1/produtos/site?${new URLSearchParams(query).toString()}`,
} as unknown as AuthenticatedRequest);

const run = async (): Promise<void> => {
  try {
    await ProdutoController.listSite(request({ busca: 'garrafa parede dupla', empresaId: '1', page: '2', limit: '24' }), response);
    assert.equal(calls[0]?.term, 'garrafa parede dupla');
    assert.equal(calls[0]?.page, 2);
    assert.equal(calls[0]?.limit, 24);
    assert.equal(responseStatus, 200);
    assert.equal((responseBody as { data?: { items?: Produto[] } }).data?.items?.[0]?.codigo, 'GT03');

    await ProdutoController.listSite(request({ search: 'bloco com pauta', empresaId: '1' }), response);
    assert.equal(calls[1]?.term, 'bloco com pauta');
    assert.equal(calls[1]?.limit, 20);
    console.log('searchController.test: aliases busca/search delegate to intelligent search');
  } finally {
    ProductSearchService.search = originalSearch;
  }
};

void run();
