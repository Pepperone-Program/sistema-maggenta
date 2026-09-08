import { QueryTokenizer } from './QueryTokenizer';
import type { NormalizedSearchQuery, SearchDictionaryEntry, SearchIntent } from '@/types/search';

export class QueryParser {
  // Dictionary entries never rewrite the query or admit extra candidates.
  static parse(query: NormalizedSearchQuery, _dictionary: SearchDictionaryEntry[] = []): SearchIntent {
    const positiveTerms = QueryTokenizer.searchTerms(query.comparable);
    if (!positiveTerms.length) {
      throw Object.assign(new Error('Informe ao menos um termo pesquisavel com 2 caracteres'), {
        code: 'NO_SEARCHABLE_TERMS',
        statusCode: 422,
      });
    }
    const booleanQuery = QueryTokenizer.buildSafeBooleanQuery(positiveTerms, true);
    return {
      original: query.original,
      normalized: query.normalized,
      comparable: query.comparable,
      attributes: [],
      materials: [],
      colors: [],
      measurements: {},
      constraints: [],
      positiveTerms,
      negativeTerms: [],
      phrases: [],
      synonyms: [],
      unknownTerms: positiveTerms,
      safeBooleanQuery: booleanQuery,
      relaxedBooleanQuery: booleanQuery,
    };
  }
}
