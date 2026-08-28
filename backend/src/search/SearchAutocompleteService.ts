import { queryWithoutRetry } from '@database/connection';
import { QueryNormalizer } from './QueryNormalizer';
import { SearchDictionaryService } from './SearchDictionaryService';
import { SEARCH_LIMITS } from './config';
import { SearchCacheService } from './SearchCacheService';

export type AutocompleteItem = {
  value: string;
  type: 'product' | 'dictionary';
  productId?: number;
  code?: string;
};

export class SearchAutocompleteService {
  static async autocomplete(empresaId: number, rawQuery: string, requestedLimit = 8): Promise<AutocompleteItem[]> {
    const normalized = QueryNormalizer.normalize(rawQuery);
    const limit = Math.min(Math.max(Math.trunc(requestedLimit) || 8, 1), 12);
    const versions = await SearchDictionaryService.getCatalogVersion(empresaId);
    return (await SearchCacheService.getOrSetAutocomplete(
      { empresaId, catalogVersion: versions.catalogVersion, dictionaryVersion: versions.dictionaryVersion, query: normalized.comparable, limit },
      async () => {
        const [products, dictionary] = await Promise.all([
          queryWithoutRetry(
            `SET STATEMENT max_statement_time=${SEARCH_LIMITS.statementTimeoutSeconds} FOR
             SELECT d.id_produto, d.original_name, p.codigo
             FROM product_search_documents d
             INNER JOIN produtos p ON p.id_empresa = d.id_empresa AND p.id_produto = d.id_produto
             WHERE d.id_empresa = ? AND d.site = 'S' AND d.habilitado = 'S'
               AND d.normalized_name LIKE ?
             ORDER BY d.normalized_name ASC, d.id_produto DESC LIMIT ?`,
            [empresaId, `${normalized.comparable}%`, limit]
          ),
          queryWithoutRetry(
            `SELECT canonical_value
             FROM search_dictionary
             WHERE id_empresa = ? AND active = 1 AND normalized_term LIKE ?
             ORDER BY priority DESC, token_count DESC, id_dictionary ASC LIMIT ?`,
            [empresaId, `${normalized.comparable}%`, limit]
          ),
        ]);
        const combined: AutocompleteItem[] = [
          ...(products as Array<{ id_produto: number; original_name: string; codigo: string }>).map((item) => ({
            value: item.original_name,
            type: 'product' as const,
            productId: Number(item.id_produto),
            code: item.codigo,
          })),
          ...(dictionary as Array<{ canonical_value: string }>).map((item) => ({
            value: item.canonical_value,
            type: 'dictionary' as const,
          })),
        ];
        const seen = new Set<string>();
        return combined.filter((item) => {
          const comparable = item.value.toLocaleLowerCase('pt-BR');
          if (seen.has(comparable)) return false;
          seen.add(comparable);
          return true;
        }).slice(0, limit);
      }
    )).value;
  }
}
