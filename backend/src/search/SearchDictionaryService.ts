import { queryWithoutRetry } from '@database/connection';
import { SEARCH_CACHE } from './config';
import { comparableSearchText } from './QueryNormalizer';
import type { SearchDictionaryEntry } from '@/types/search';

type DictionaryRow = {
  id_dictionary: number;
  id_empresa: number;
  term: string;
  normalized_term: string;
  term_type: SearchDictionaryEntry['termType'];
  relation_type: SearchDictionaryEntry['relationType'];
  canonical_value: string;
  id_tipo_produto: number | null;
  id_attribute: number | null;
  id_option: number | null;
  priority: number;
  confidence: string | number;
  token_count: number;
};

type CacheEntry = { expiresAt: number; version: string; entries: SearchDictionaryEntry[] };
type CatalogVersion = { catalogVersion: number; dictionaryVersion: number };
type VersionCacheEntry = { expiresAt: number; value: CatalogVersion };
type ProductTypeRow = { id_tipo_produto: number; tipo_produto: string };

const cache = new Map<number, CacheEntry>();
const versionCache = new Map<number, VersionCacheEntry>();
const readyCatalogs = new Set<number>();

export class SearchDictionaryService {
  static async prepareCatalog(empresaId: number): Promise<{
    versions: CatalogVersion;
    dictionary: SearchDictionaryEntry[];
  }> {
    const [, dictionary] = await Promise.all([
      this.assertCatalogReady(empresaId),
      this.getEntries(empresaId),
    ]);
    return { versions: await this.getCatalogVersion(empresaId), dictionary };
  }

  static async assertCatalogReady(empresaId: number): Promise<void> {
    if (readyCatalogs.has(empresaId)) return;
    const rows = (await queryWithoutRetry(
      `SELECT
         EXISTS(SELECT 1 FROM search_dictionary WHERE id_empresa = ? AND active = 1) AS has_dictionary,
         EXISTS(SELECT 1 FROM search_attribute_definitions WHERE id_empresa = ? AND active = 1) AS has_attributes,
         (SELECT catalog_version FROM search_catalog_versions WHERE id_empresa = ? LIMIT 1) AS catalog_version,
         (SELECT dictionary_version FROM search_catalog_versions WHERE id_empresa = ? LIMIT 1) AS dictionary_version,
         (SELECT COUNT(*) FROM produtos WHERE id_empresa = ? AND site = 'S' AND habilitado = 'S') AS public_products,
         (SELECT COUNT(*) FROM produtos p
          INNER JOIN product_search_documents d ON d.id_empresa = p.id_empresa AND d.id_produto = p.id_produto
          WHERE p.id_empresa = ? AND p.site = 'S' AND p.habilitado = 'S'
            AND d.site = 'S' AND d.habilitado = 'S') AS public_documents`,
      [empresaId, empresaId, empresaId, empresaId, empresaId, empresaId]
    )) as Array<{
      has_dictionary: number;
      has_attributes: number;
      catalog_version: number | string | null;
      dictionary_version: number | string | null;
      public_products: number | string;
      public_documents: number | string;
    }>;
    const readiness = rows[0];
    const publicProducts = Number(readiness?.public_products || 0);
    const publicDocuments = Number(readiness?.public_documents || 0);
    if (!readiness
      || !readiness.has_dictionary
      || !readiness.has_attributes
      || readiness.catalog_version === null
      || readiness.dictionary_version === null
      || publicProducts === 0
      || publicDocuments < publicProducts) {
      throw Object.assign(new Error('Catalogo de busca ainda nao foi preparado para este tenant'), {
        code: 'SEARCH_CATALOG_NOT_READY',
        statusCode: 503,
        details: {
          dictionary: Boolean(readiness?.has_dictionary),
          attributes: Boolean(readiness?.has_attributes),
          catalogVersion: readiness?.catalog_version === null ? null : Number(readiness?.catalog_version),
          publicProducts,
          publicDocuments,
          documentCoverage: publicProducts > 0 ? publicDocuments / publicProducts : 0,
        },
      });
    }
    versionCache.set(empresaId, {
      expiresAt: Date.now() + SEARCH_CACHE.dictionaryTtlMs,
      value: {
        catalogVersion: Number(readiness.catalog_version),
        dictionaryVersion: Number(readiness.dictionary_version),
      },
    });
    readyCatalogs.add(empresaId);
  }

  static async getCatalogVersion(empresaId: number): Promise<CatalogVersion> {
    const cached = versionCache.get(empresaId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const rows = (await queryWithoutRetry(
      `SELECT catalog_version, dictionary_version
       FROM search_catalog_versions WHERE id_empresa = ? LIMIT 1`,
      [empresaId]
    )) as Array<{ catalog_version: number; dictionary_version: number }>;
    const value = {
      catalogVersion: Number(rows[0]?.catalog_version || 1),
      dictionaryVersion: Number(rows[0]?.dictionary_version || 1),
    };
    versionCache.set(empresaId, { expiresAt: Date.now() + SEARCH_CACHE.dictionaryTtlMs, value });
    return value;
  }

  static async getEntries(
    empresaId: number,
    knownVersion?: { catalogVersion: number; dictionaryVersion: number }
  ): Promise<SearchDictionaryEntry[]> {
    const cachedVersion = versionCache.get(empresaId);
    const usableCachedVersion = cachedVersion && cachedVersion.expiresAt > Date.now()
      ? cachedVersion.value
      : undefined;
    const version = knownVersion || usableCachedVersion;
    const cached = cache.get(empresaId);
    const expectedCacheVersion = version ? `${version.catalogVersion}:${version.dictionaryVersion}` : undefined;
    if (cached && cached.expiresAt > Date.now() && cached.version === expectedCacheVersion) {
      return cached.entries;
    }

    const [resolvedVersion, rows, productTypes] = await Promise.all([
      version ? Promise.resolve(version) : this.getCatalogVersion(empresaId),
      (queryWithoutRetry(
      `SELECT id_dictionary, id_empresa, term, normalized_term, term_type,
              relation_type, canonical_value, id_tipo_produto, id_attribute,
              id_option, priority, confidence, token_count
       FROM search_dictionary
       WHERE id_empresa = ? AND active = 1
      ORDER BY token_count DESC, priority DESC, id_dictionary ASC`,
      [empresaId]
    ) as Promise<DictionaryRow[]>), (queryWithoutRetry(
      `SELECT tp.id_tipo_produto, tp.tipo_produto
       FROM tipos_produtos tp
       WHERE tp.id_empresa = ? AND tp.habilitado = 'S'
       ORDER BY tp.id_tipo_produto ASC`,
      [empresaId]
    ) as Promise<ProductTypeRow[]>)]);
    const manualEntries = rows.map((row) => ({
      id: Number(row.id_dictionary),
      idEmpresa: Number(row.id_empresa),
      term: row.term,
      normalizedTerm: row.normalized_term,
      termType: row.term_type,
      relationType: row.relation_type,
      canonicalValue: row.canonical_value,
      productTypeId: row.id_tipo_produto === null ? null : Number(row.id_tipo_produto),
      attributeId: row.id_attribute === null ? null : Number(row.id_attribute),
      optionId: row.id_option === null ? null : Number(row.id_option),
      priority: Number(row.priority),
      confidence: Number(row.confidence),
      tokenCount: Number(row.token_count),
    }));
    const manualProductTerms = new Set(manualEntries
      .filter((entry) => entry.termType === 'PRODUCT_TYPE')
      .map((entry) => entry.normalizedTerm));
    const automaticEntries = productTypes
      .map((row, index): SearchDictionaryEntry => {
        const normalizedTerm = comparableSearchText(row.tipo_produto);
        return {
          id: -(index + 1),
          idEmpresa: empresaId,
          term: row.tipo_produto,
          normalizedTerm,
          termType: 'PRODUCT_TYPE',
          relationType: 'EXACT_SYNONYM',
          canonicalValue: normalizedTerm,
          productTypeId: Number(row.id_tipo_produto),
          attributeId: null,
          optionId: null,
          priority: 500,
          confidence: 1,
          tokenCount: normalizedTerm.split(/\s+/).filter(Boolean).length,
        };
      })
      .filter((entry) => entry.normalizedTerm && !manualProductTerms.has(entry.normalizedTerm));
    const entries = [...manualEntries, ...automaticEntries]
      .sort((left, right) => right.tokenCount - left.tokenCount || right.priority - left.priority || left.id - right.id);
    cache.set(empresaId, {
      expiresAt: Date.now() + SEARCH_CACHE.dictionaryTtlMs,
      version: `${resolvedVersion.catalogVersion}:${resolvedVersion.dictionaryVersion}`,
      entries,
    });
    return entries;
  }

  static invalidate(empresaId: number): void {
    cache.delete(empresaId);
    versionCache.delete(empresaId);
    readyCatalogs.delete(empresaId);
  }
}
