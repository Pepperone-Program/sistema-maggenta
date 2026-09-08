import { comparableSearchText } from './QueryNormalizer';

const STOPWORDS = new Set([
  'a',
  'as',
  'com',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'o',
  'os',
  'para',
  'por',
]);

export class QueryTokenizer {
  static words(text: string): string[] {
    return comparableSearchText(text).match(/[a-z0-9]+/g) || [];
  }

  static safeTokens(tokens: string[]): string[] {
    return Array.from(
      new Set(tokens.flatMap((token) => this.words(token)).filter((token) => token.length >= 2)),
    );
  }

  static searchTerms(text: string): string[] {
    return this.safeTokens([text]).filter((token) => !STOPWORDS.has(token));
  }

  static buildSafeBooleanQuery(tokens: string[], required = false): string {
    return this.safeTokens(tokens)
      .map((token) => (required ? '+' : '') + token + '*')
      .join(' ');
  }
}

export const buildSafeBooleanQuery = (tokens: string[]): string =>
  QueryTokenizer.buildSafeBooleanQuery(tokens);
