import '../module-alias';
import assert from 'node:assert/strict';
import { closeDatabasePool } from '@database/connection';
import { ProductSearchService } from '@search/ProductSearchService';

const run = async (): Promise<void> => {
  const empresaId = Number(process.argv[2] || process.env.SEARCH_PUBLIC_DEFAULT_EMPRESA_ID || process.env.SITE_API_EMPRESA_ID || 1);
  for (const limit of [10, 24, 40]) {
    const result = await ProductSearchService.search({ empresaId, term: 'garrafa', page: 1, limit, sort: 'relevance', filters: {}, locale: 'pt-BR' });
    assert.equal(result.match_exato_codigo, false);
    if (!result.match_exato_codigo) {
      assert.equal(result.limit, limit);
      assert.equal(result.items.length <= limit, true);
      assert.equal(result.page, 1);
      assert.equal(typeof result.total, 'number');
      assert.equal(result.mode, 'legacy');
      assert.equal(result.groups.primary.length, result.items.length);
      assert.equal(result.groups.related.length, 0);
      assert.equal(result.totalPages, Math.ceil(result.total / limit));
    }
  }
  const suffix = await ProductSearchService.search({ empresaId, term: 'GF042', page: 1, limit: 20, sort: 'relevance', filters: {}, locale: 'pt-BR' });
  assert.equal(suffix.match_exato_codigo, true);
  if (suffix.match_exato_codigo) assert.equal(suffix.codigo.toLocaleUpperCase('pt-BR'), 'GF042C');
  console.log('smokeLegacySearchContract: limits 10/24/40 and C suffix priority ok');
};

run().catch((error) => { console.error('[search:smoke-legacy]', error); process.exitCode = 1; }).finally(() => closeDatabasePool());
