import crypto from 'crypto';
import { CacheService } from '@services/CacheService';
import { SEARCH_CACHE } from './config';

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)]));
  }
  return value;
};

const digest = (value: unknown): string =>
  crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0, 32);

export class SearchCacheService {
  static resultKey(input: unknown): string {
    return CacheService.buildKey('search-v2', digest(input));
  }

  static autocompleteKey(input: unknown): string {
    return CacheService.buildKey('search-autocomplete', digest(input));
  }

  static getOrSetResult<T>(keyInput: unknown, loader: () => Promise<T>) {
    return CacheService.getOrSetCoalesced(this.resultKey(keyInput), loader, SEARCH_CACHE.resultTtlSeconds);
  }

  static getOrSetAutocomplete<T>(keyInput: unknown, loader: () => Promise<T>) {
    return CacheService.getOrSetCoalesced(this.autocompleteKey(keyInput), loader, SEARCH_CACHE.autocompleteTtlSeconds);
  }
}
