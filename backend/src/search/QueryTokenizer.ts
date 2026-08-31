const SAFE_TOKEN = /^[a-z0-9][a-z0-9.,]*$/;

export class QueryTokenizer {
  static safeTokens(tokens: string[]): string[] {
    return Array.from(
      new Set(
        tokens
          .flatMap((token) => token.split(/\s+/))
          .map((token) => token.replace(/[^a-z0-9.,]/g, ''))
          .filter((token) => token.length >= 2 && SAFE_TOKEN.test(token))
      )
    );
  }

  static buildSafeBooleanQuery(tokens: string[], required = false): string {
    return this.safeTokens(tokens)
      .filter((token) => token.length >= 3)
      .map((token) => `${required ? '+' : ''}${token.replace(/[.,]/g, '')}*`)
      .filter((token) => token.replace(/[+*]/g, '').length >= 3)
      .join(' ');
  }
}

export const buildSafeBooleanQuery = (tokens: string[]): string =>
  QueryTokenizer.buildSafeBooleanQuery(tokens, true);
