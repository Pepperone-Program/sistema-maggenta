import { queryWithoutRetry } from '@database/connection';
import { SEARCH_CACHE } from './config';
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

type CacheEntry = { expiresAt: number; version: number; entries: SearchDictionaryEntry[] };

const cache = new Map<number, CacheEntry>();

export class SearchDictionaryService {
  static async getCatalogVersion(empresaId: number): Promise<{ catalogVersion: number; dictionaryVersion: number }> {
    const rows = (await queryWithoutRetry(
      `SELECT catalog_version, dictionary_version
       FROM search_catalog_versions WHERE id_empresa = ? LIMIT 1`,
      [empresaId]
    )) as Array<{ catalog_version: number; dictionary_version: number }>;
    return {
      catalogVersion: Number(rows[0]?.catalog_version || 1),
      dictionaryVersion: Number(rows[0]?.dictionary_version || 1),
    };
  }

  static async getEntries(
    empresaId: number,
    knownVersion?: { catalogVersion: number; dictionaryVersion: number }
  ): Promise<SearchDictionaryEntry[]> {
    const version = knownVersion || await this.getCatalogVersion(empresaId);
    const cached = cache.get(empresaId);
    if (cached && cached.expiresAt > Date.now() && cached.version === version.dictionaryVersion) {
      return cached.entries;
    }

    const rows = (await queryWithoutRetry(
      `SELECT id_dictionary, id_empresa, term, normalized_term, term_type,
              relation_type, canonical_value, id_tipo_produto, id_attribute,
              id_option, priority, confidence, token_count
       FROM search_dictionary
       WHERE id_empresa = ? AND active = 1
       ORDER BY token_count DESC, priority DESC, id_dictionary ASC`,
      [empresaId]
    )) as DictionaryRow[];
    const entries = rows.map((row) => ({
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
    cache.set(empresaId, {
      expiresAt: Date.now() + SEARCH_CACHE.dictionaryTtlMs,
      version: version.dictionaryVersion,
      entries,
    });
    return entries;
  }

  static invalidate(empresaId: number): void {
    cache.delete(empresaId);
  }
}
