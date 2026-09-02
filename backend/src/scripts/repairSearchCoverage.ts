import '../module-alias';
import { closeDatabasePool, query } from '@database/connection';
import { SearchDocumentService } from '@search/SearchDocumentService';

const run = async (): Promise<void> => {
  const empresaId = Number(process.argv[2] || process.env.SEARCH_REBUILD_EMPRESA_ID);
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new Error('Informe o tenant: npm run search:repair-coverage -- <empresaId>');
  }

  const missing = await query(
    `SELECT p.id_produto
     FROM produtos p
     LEFT JOIN product_search_documents d
       ON d.id_empresa = p.id_empresa AND d.id_produto = p.id_produto
     WHERE p.id_empresa = ?
       AND p.site = 'S'
       AND p.habilitado = 'S'
       AND (d.id_produto IS NULL OR d.site <> 'S' OR d.habilitado <> 'S')
     ORDER BY p.id_produto ASC`,
    [empresaId]
  ) as Array<{ id_produto: number }>;

  for (const row of missing) {
    await SearchDocumentService.refreshProduct(empresaId, Number(row.id_produto), null, false);
  }
  if (missing.length) {
    await SearchDocumentService.incrementCatalogVersion(empresaId);
  }

  console.log(JSON.stringify({
    empresaId,
    repaired: missing.length,
    productIds: missing.map((row) => Number(row.id_produto)),
  }));
};

run()
  .catch((error) => {
    console.error('[search:repair-coverage]', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => closeDatabasePool());
