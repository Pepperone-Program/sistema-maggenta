import { SEARCH_LIMITS } from './config';
import type { NormalizedSearchQuery } from '@/types/search';

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/g;
const COMBINING_MARKS = /[\u0300-\u036f]/g;
const LEGACY_STOP_WORDS = new Set([
  'a', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'o', 'os', 'para', 'por',
]);

export const comparableSearchText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLocaleLowerCase('pt-BR')
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export class QueryNormalizer {
  static normalize(input: string): NormalizedSearchQuery {
    const original = String(input || '').replace(CONTROL_CHARACTERS, ' ').trim();
    if (original.length < SEARCH_LIMITS.minSearchLength) {
      throw Object.assign(new Error('A busca deve possuir ao menos 2 caracteres'), {
        code: 'INVALID_SEARCH_LENGTH',
        statusCode: 422,
      });
    }
    if (original.length > SEARCH_LIMITS.maxSearchLength) {
      throw Object.assign(new Error('A busca deve possuir no maximo 200 caracteres'), {
        code: 'INVALID_SEARCH_LENGTH',
        statusCode: 422,
      });
    }

    const normalized = original.normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
    const comparable = comparableSearchText(normalized);
    const tokens = comparable
      .split(/\s+/)
      .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9.,"]+$/g, ''))
      .filter(Boolean);

    if (tokens.length > SEARCH_LIMITS.maxTokens) {
      throw Object.assign(new Error('A busca excede o limite de 20 termos'), {
        code: 'SEARCH_TOO_COMPLEX',
        statusCode: 422,
      });
    }

    return { original, normalized, comparable, tokens };
  }
}

export const normalizeSearchQuery = (query: string): NormalizedSearchQuery =>
  QueryNormalizer.normalize(query);

export const legacySearchTerms = (tokens: string[]): string[] => {
  const sanitized = tokens
    .map((token) => token.replace(/[^a-z0-9]+/g, ''))
    .filter((token) => token.length > 0 && !LEGACY_STOP_WORDS.has(token));
  const unique = Array.from(new Set(sanitized));

  // Consultas formadas apenas por palavras de ligacao ainda precisam ser pesquisaveis.
  return unique.length > 0 ? unique : tokens.map((token) => token.replace(/[^a-z0-9]+/g, '')).filter(Boolean);
};
