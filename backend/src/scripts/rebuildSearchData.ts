import '../module-alias';
import { closeDatabasePool, query } from '@database/connection';
import { SearchDocumentService } from '@search/SearchDocumentService';

const run = async (): Promise<void> => {
  const empresaId = Number(process.argv[2] || process.env.SEARCH_REBUILD_EMPRESA_ID);
  const batchSize = Math.min(Math.max(Number(process.argv[3] || 200), 10), 1000);
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error('Informe o tenant: npm run search:rebuild -- <empresaId> [batchSize]');
  const statisticsColumns = await query(`SELECT COUNT(*) AS total FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'estatisticas_produtos' AND column_name = 'id_empresa'`) as Array<{ total: number }>;
  const statisticsHasTenant = Number(statisticsColumns[0]?.total || 0) > 0;
  if (!statisticsHasTenant) {
    const duplicateIds = await query(`SELECT COUNT(*) AS total FROM (
      SELECT id_produto FROM produtos GROUP BY id_produto HAVING COUNT(DISTINCT id_empresa) > 1
    ) duplicated_products`) as Array<{ total: number }>;
    if (Number(duplicateIds[0]?.total || 0) > 0) throw new Error('Popularidade nao pode ser isolada: estatisticas_produtos nao possui tenant e ha IDs de produto repetidos entre tenants');
  }
  const statisticsTenantJoin = statisticsHasTenant ? ' AND ep.id_empresa = p.id_empresa' : '';
  let lastId = 0;
  let processed = 0;
  for (;;) {
    const products = await query(
      `SELECT id_produto FROM produtos WHERE id_empresa = ? AND id_produto > ?
       ORDER BY id_produto ASC LIMIT ?`,
      [empresaId, lastId, batchSize]
    ) as Array<{ id_produto: number }>;
    if (!products.length) break;
    const ids = products.map((item) => Number(item.id_produto));
    const inSql = ids.map(() => '?').join(',');
    await query(
      `INSERT INTO product_search_popularity (id_empresa, id_produto, popularity_score, calculated_at)
       SELECT ?, p.id_produto, COALESCE(SUM(ep.qtde), 0), NOW()
       FROM produtos p
       LEFT JOIN estatisticas_produtos ep ON ep.id_produto = p.id_produto${statisticsTenantJoin}
       WHERE p.id_empresa = ? AND p.id_produto IN (${inSql})
       GROUP BY p.id_produto
       ON DUPLICATE KEY UPDATE popularity_score = VALUES(popularity_score), calculated_at = NOW()`,
      [empresaId, empresaId, ...ids]
    );
    for (const id of ids) await SearchDocumentService.refreshProduct(empresaId, id, null, false);
    lastId = ids[ids.length - 1];
    processed += ids.length;
    console.log(JSON.stringify({ empresaId, processed, lastId }));
  }
  await SearchDocumentService.incrementCatalogVersion(empresaId);
  console.log(JSON.stringify({ empresaId, processed, complete: true }));
};

run().catch((error) => { console.error('[search:rebuild]', error); process.exitCode = 1; }).finally(() => closeDatabasePool());
