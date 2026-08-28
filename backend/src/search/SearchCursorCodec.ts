import crypto from 'crypto';
import type { RankedSearchCandidate, SearchCursor } from '@/types/search';

const secret = (): string => {
  const configured = process.env.SEARCH_CURSOR_SECRET || process.env.JWT_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('SEARCH_CURSOR_SECRET nao configurado'), { code: 'SEARCH_CURSOR_SECRET_NOT_CONFIGURED', statusCode: 503 });
  }
  return 'development-search-cursor-secret';
};

const queryHash = (query: string): string =>
  crypto.createHash('sha256').update(query).digest('hex').slice(0, 24);

const signature = (payload: string): string =>
  crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

const tuple = (candidate: RankedSearchCandidate): SearchCursor['last'] => ({
  primaryTypeMatch: candidate.primaryTypeMatch ? 1 : 0,
  contradictions: candidate.contradictions,
  matchedConstraints: candidate.matchedConstraints,
  group: candidate.group === 'PRIMARY' ? 1 : 0,
  totalScore: candidate.score.total,
  popularity: candidate.candidate.popularidade,
  idProduto: candidate.candidate.idProduto,
  newestDate: candidate.candidate.dataInclusao || '',
});

export class SearchCursorCodec {
  static queryHash(query: string): string {
    return queryHash(query);
  }

  static encode(input: Omit<SearchCursor, 'expiresAt'>, ttlMs = 15 * 60 * 1000): string {
    const payload = Buffer.from(JSON.stringify({ ...input, expiresAt: Date.now() + ttlMs })).toString('base64url');
    return `${payload}.${signature(payload)}`;
  }

  static decode(cursor: string): SearchCursor {
    const [payload, providedSignature, extra] = cursor.split('.');
    if (!payload || !providedSignature || extra) throw this.invalid();
    const expected = signature(payload);
    const left = Buffer.from(providedSignature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) throw this.invalid();
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SearchCursor;
      if (!parsed.expiresAt || parsed.expiresAt < Date.now()) throw this.invalid();
      return parsed;
    } catch {
      throw this.invalid();
    }
  }

  static tuple(candidate: RankedSearchCandidate): SearchCursor['last'] {
    return tuple(candidate);
  }

  static isAfterCursor(candidate: RankedSearchCandidate, last: SearchCursor['last'], sort: SearchCursor['sort']): boolean {
    const current = tuple(candidate);
    const sortValues = sort === 'newest'
      ? [current.newestDate]
      : sort === 'popular'
        ? [current.popularity]
        : [current.totalScore];
    const lastSortValues = sort === 'newest'
      ? [last.newestDate]
      : sort === 'popular'
        ? [last.popularity]
        : [last.totalScore];
    const currentValues = [current.primaryTypeMatch, -current.contradictions, current.matchedConstraints, current.group, ...sortValues, current.totalScore, current.popularity, current.idProduto];
    const lastValues = [last.primaryTypeMatch, -last.contradictions, last.matchedConstraints, last.group, ...lastSortValues, last.totalScore, last.popularity, last.idProduto];
    for (let index = 0; index < currentValues.length; index += 1) {
      if (currentValues[index] !== lastValues[index]) return currentValues[index] < lastValues[index];
    }
    return false;
  }

  private static invalid(): Error & { code: string; statusCode: number } {
    return Object.assign(new Error('Cursor de busca invalido ou expirado'), { code: 'INVALID_SEARCH_CURSOR', statusCode: 422 });
  }
}
