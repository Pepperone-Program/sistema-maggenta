import '../module-alias';
import { closeDatabasePool, query } from '@database/connection';

const requiredTables = [
  'schema_migrations',
  'search_attribute_definitions',
  'search_attribute_options',
  'search_attribute_conflicts',
  'product_search_attributes',
  'product_search_contains_types',
  'search_dictionary',
  'product_search_documents',
  'product_search_popularity',
  'search_catalog_versions',
  'search_events',
  'search_click_events',
  'search_conversion_events',
];

const requiredMigrations = ['001-search-core', '002-search-analytics'];

type TenantCount = { id_empresa: number; total: number | string; public_enabled?: number | string };

const run = async (): Promise<void> => {
  const [version] = await query(`SELECT VERSION() AS version, DATABASE() AS database_name, @@max_connections AS max_connections,
    @@innodb_ft_min_token_size AS ft_min_token_size, @@character_set_database AS charset_name, @@collation_database AS collation_name`);
  const rows = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name IN (${requiredTables.map(() => '?').join(',')})`,
    requiredTables
  ) as Array<{ table_name: string }>;
  const existing = new Set(rows.map((row) => row.table_name));
  const missing = requiredTables.filter((table) => !existing.has(table));
  const publicTenantId = Number(process.env.SEARCH_PUBLIC_DEFAULT_EMPRESA_ID || process.env.SITE_API_EMPRESA_ID || 1);
  const migrationRows = existing.has('schema_migrations')
    ? await query('SELECT id, description, applied_at FROM schema_migrations ORDER BY id') as Array<{ id: string; description: string; applied_at: Date | string }>
    : [];
  const appliedMigrationIds = new Set(migrationRows.map((row) => row.id));
  const missingMigrations = requiredMigrations.filter((id) => !appliedMigrationIds.has(id));
  let catalogs: Array<{
    empresaId: number;
    products: number;
    publicEnabledProducts: number;
    documents: number;
    publicEnabledDocuments: number;
    dictionaryEntries: number;
    attributeDefinitions: number;
    catalogVersions: number;
    publicDocumentCoverage: number;
    ready: boolean;
  }> = [];
  if (missing.length === 0) {
    const [products, documents, dictionary, attributes, catalogVersions] = await Promise.all([
      query(`SELECT id_empresa, COUNT(*) AS total,
                    SUM(site = 'S' AND habilitado = 'S') AS public_enabled
             FROM produtos GROUP BY id_empresa`) as Promise<TenantCount[]>,
      query(`SELECT p.id_empresa, COUNT(d.id_produto) AS total,
                    SUM(p.site = 'S' AND p.habilitado = 'S'
                      AND d.site = 'S' AND d.habilitado = 'S') AS public_enabled
             FROM produtos p
             LEFT JOIN product_search_documents d
               ON d.id_empresa = p.id_empresa AND d.id_produto = p.id_produto
             GROUP BY p.id_empresa`) as Promise<TenantCount[]>,
      query(`SELECT id_empresa, COUNT(*) AS total FROM search_dictionary
             WHERE active = 1 GROUP BY id_empresa`) as Promise<TenantCount[]>,
      query(`SELECT id_empresa, COUNT(*) AS total FROM search_attribute_definitions
             WHERE active = 1 GROUP BY id_empresa`) as Promise<TenantCount[]>,
      query(`SELECT id_empresa, COUNT(*) AS total FROM search_catalog_versions GROUP BY id_empresa`) as Promise<TenantCount[]>,
    ]);
    const countByTenant = (values: TenantCount[], empresaId: number, key: 'total' | 'public_enabled' = 'total'): number =>
      Number(values.find((row) => Number(row.id_empresa) === empresaId)?.[key] || 0);
    catalogs = products.map((product) => {
      const empresaId = Number(product.id_empresa);
      const publicEnabledProducts = Number(product.public_enabled || 0);
      const publicEnabledDocuments = countByTenant(documents, empresaId, 'public_enabled');
      const dictionaryEntries = countByTenant(dictionary, empresaId);
      const attributeDefinitions = countByTenant(attributes, empresaId);
      const catalogVersionCount = countByTenant(catalogVersions, empresaId);
      const publicDocumentCoverage = publicEnabledProducts > 0
        ? publicEnabledDocuments / publicEnabledProducts
        : 1;
      return {
        empresaId,
        products: Number(product.total),
        publicEnabledProducts,
        documents: countByTenant(documents, empresaId),
        publicEnabledDocuments,
        dictionaryEntries,
        attributeDefinitions,
        catalogVersions: catalogVersionCount,
        publicDocumentCoverage,
        ready: dictionaryEntries > 0
          && attributeDefinitions > 0
          && catalogVersionCount > 0
          && publicDocumentCoverage >= 1,
      };
    });
  }
  const [statisticsTenantColumn, duplicateProductIds] = await Promise.all([
    query(`SELECT COUNT(*) AS total FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'estatisticas_produtos' AND column_name = 'id_empresa'`),
    query(`SELECT COUNT(*) AS total FROM (
      SELECT id_produto FROM produtos GROUP BY id_produto HAVING COUNT(DISTINCT id_empresa) > 1
    ) duplicated_products`),
  ]);
  const statisticsHasTenant = Number(statisticsTenantColumn[0]?.total || 0) > 0;
  const duplicateIds = Number(duplicateProductIds[0]?.total || 0);
  const replicas = Number(process.env.SEARCH_EXPECTED_REPLICAS || 0);
  const poolSize = Number(process.env.DB_CONNECTION_LIMIT || 30);
  const maximumConnections = Number(version.max_connections);
  const poolShare = replicas > 0 ? (replicas * poolSize) / maximumConnections : null;
  const checks = {
    database: version,
    schemaPrepared: missing.length === 0,
    missingTables: missing,
    migrations: {
      applied: migrationRows,
      missing: missingMigrations,
      prepared: missingMigrations.length === 0,
    },
    catalog: {
      publicTenantId,
      tenants: catalogs,
      ready: catalogs.find((catalog) => catalog.empresaId === publicTenantId)?.ready || false,
    },
    rollout: {
      rankingPercentage: Number(process.env.SEARCH_RANKING_PERCENTAGE || 0),
      shadowPercentage: Number(process.env.SEARCH_SHADOW_PERCENTAGE || 0),
      writeSyncEnabled: process.env.SEARCH_WRITE_SYNC_ENABLED === 'true',
    },
    capacity: {
      expectedReplicas: replicas || 'NOT_CONFIGURED',
      poolSize,
      maximumConnections,
      projectedShare: poolShare,
      underSeventyPercent: poolShare === null ? false : poolShare <= 0.7,
    },
    secrets: {
      cursorSecretConfigured: Boolean(process.env.SEARCH_CURSOR_SECRET || process.env.JWT_SECRET),
      publicTenantConfigured: Boolean(process.env.SEARCH_PUBLIC_DEFAULT_EMPRESA_ID || process.env.SITE_API_EMPRESA_ID),
    },
    popularity: {
      statisticsHasTenant,
      duplicateProductIdsAcrossTenants: duplicateIds,
      tenantSafe: statisticsHasTenant || duplicateIds === 0,
    },
  };
  console.log(JSON.stringify(checks, null, 2));
  const rankingAuthorized = checks.rollout.rankingPercentage === 0 || process.env.SEARCH_PREFLIGHT_ALLOW_RANKING === 'true';
  const schemaRequired = checks.rollout.rankingPercentage > 0 || checks.rollout.shadowPercentage > 0 || checks.rollout.writeSyncEnabled;
  const writeSyncReady = checks.rollout.rankingPercentage === 0 || checks.rollout.writeSyncEnabled;
  if (!rankingAuthorized
    || (schemaRequired && (!checks.schemaPrepared || !checks.migrations.prepared || !checks.catalog.ready))
    || !writeSyncReady
    || !checks.capacity.underSeventyPercent
    || !checks.secrets.cursorSecretConfigured
    || !checks.secrets.publicTenantConfigured
    || !checks.popularity.tenantSafe) {
    process.exitCode = 2;
  }
};

run().catch((error) => {
  console.error('[search:preflight]', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => closeDatabasePool());
