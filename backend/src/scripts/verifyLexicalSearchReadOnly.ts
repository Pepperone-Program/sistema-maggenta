import '../module-alias';
import assert from 'node:assert/strict';
import { closeDatabasePool, queryWithoutRetry } from '@database/connection';
import { CandidateRetriever } from '@search/CandidateRetriever';
import { QueryNormalizer } from '@search/QueryNormalizer';
import { QueryParser } from '@search/QueryParser';
import { ProductRankingEngine } from '@search/ProductRankingEngine';
import { SearchDictionaryService } from '@search/SearchDictionaryService';
import { SearchCacheService } from '@search/SearchCacheService';

// Only SELECT statements. No analytics, Redis writes, migrations or fixture writes.
const run = async () => {
  process.env.UPSTASH_REDIS_REST_URL = '';
  process.env.UPSTASH_REDIS_REST_TOKEN = '';
  const tenant = Number(process.argv[2] || 1);
  await SearchDictionaryService.assertCatalogReady(tenant);
  const settings = await queryWithoutRetry(
    'SELECT @@innodb_ft_min_token_size AS minToken, @@innodb_ft_enable_stopword AS stopwords',
  );
  const indexes = await queryWithoutRetry(
    "SELECT index_name,column_name FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='product_search_documents' AND index_type='FULLTEXT'",
  );
  console.log(JSON.stringify({ settings, indexes }));
  const search = async (query: string) => {
    const intent = QueryParser.parse(QueryNormalizer.normalize(query));
    const start = Date.now();
    const found = await CandidateRetriever.retrieve(tenant, intent, {});
    const ranked = ProductRankingEngine.rank(found.candidates, intent);
    assert.equal(
      ranked.every((item) => item.lexical.complete),
      true,
      'Every API candidate must cover every searchable term',
    );
    assert.equal(
      ranked.every((item) => item.candidate.idEmpresa === tenant),
      true,
    );
    return { ranked, elapsed: Date.now() - start, database: found.databaseTimeMs };
  };
  const cafe = await search('cafe');
  const accented = await search('caf\u00e9');
  assert.deepEqual(
    cafe.ranked.map((p) => p.candidate.idProduto),
    accented.ranked.map((p) => p.candidate.idProduto),
  );
  for (const query of [
    'cafe',
    'caneca cafe',
    'kit churrasco',
    'garrafa',
    'personalizado',
    'A5',
    'UV',
    'cafffe',
  ]) {
    const value = query === 'cafe' ? cafe : await search(query);
    console.log(
      JSON.stringify({
        query,
        count: value.ranked.length,
        complete: value.ranked.filter((p) => p.lexical.complete).length,
        elapsed: value.elapsed,
        database: value.database,
        top: value.ranked
          .slice(0, 5)
          .map((p) => ({ code: p.candidate.codigo, title: p.candidate.produto, evidence: p.lexical })),
      }),
    );
  }
  const filtered = await CandidateRetriever.retrieve(
    tenant,
    QueryParser.parse(QueryNormalizer.normalize('cafe')),
    { productTypeId: 2147483647 },
  );
  assert.equal(filtered.candidates.length, 0, 'Explicit product type filter must remain mandatory');
  const noTenant = await CandidateRetriever.retrieve(
    2147483647,
    QueryParser.parse(QueryNormalizer.normalize('cafe')),
    {},
  );
  assert.equal(noTenant.candidates.length, 0, 'Tenant isolation');
  const cacheKey = { verification: 'lexical-read-only', tenant };
  const start = Date.now();
  const cold = await SearchCacheService.getOrSetRankingPlan(cacheKey, () => search('caneca cafe'));
  const coldMs = Date.now() - start;
  const warmStart = Date.now();
  const warm = await SearchCacheService.getOrSetRankingPlan(cacheKey, () => search('caneca cafe'));
  const warmMs = Date.now() - warmStart;
  const concurrent = await Promise.all(['cafe', 'caneca cafe', 'garrafa'].map(search));
  console.log(
    JSON.stringify({
      cache: { cold: cold.status, coldMs, warm: warm.status, warmMs },
      concurrentMs: concurrent.map((item) => item.elapsed),
    }),
  );
};
run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => closeDatabasePool());
