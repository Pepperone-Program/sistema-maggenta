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

type LocalEntry = { expiresAt: number; value: unknown };
const localRankingPlans = new Map<string, LocalEntry>();

const rememberRankingPlan = <T>(key: string, value: T): void => {
  localRankingPlans.delete(key);
  localRankingPlans.set(key, { expiresAt: Date.now() + SEARCH_CACHE.resultTtlSeconds * 1000, value });
  while (localRankingPlans.size > SEARCH_CACHE.rankingPlanMaxEntries) {
    const oldest = localRankingPlans.keys().next().value as string | undefined;
    if (!oldest) break;
    localRankingPlans.delete(oldest);
  }
};

export class SearchCacheService {
  static resultKey(input: unknown): string {
    return CacheService.buildKey('search-v3', digest(input));
  }

  static rankingPlanKey(input: unknown): string {
    return CacheService.buildKey('search-v3-plan-high-only', digest(input));
  }

  static autocompleteKey(input: unknown): string {
    return CacheService.buildKey('search-autocomplete', digest(input));
  }

  static getOrSetResult<T>(keyInput: unknown, loader: () => Promise<T>) {
    return CacheService.getOrSetCoalesced(this.resultKey(keyInput), loader, SEARCH_CACHE.resultTtlSeconds);
  }

  static async getOrSetRankingPlan<T>(keyInput: unknown, loader: () => Promise<T>) {
    const key = this.rankingPlanKey(keyInput);
    const local = localRankingPlans.get(key);
    if (local && local.expiresAt > Date.now()) {
      localRankingPlans.delete(key);
      localRankingPlans.set(key, local);
      return { value: local.value as T, status: 'hit' as const };
    }
    if (local) localRankingPlans.delete(key);
    const cached = await CacheService.getOrSetCoalesced(key, loader, SEARCH_CACHE.resultTtlSeconds, 5_000);
    rememberRankingPlan(key, cached.value);
    return cached;
  }

  static getOrSetAutocomplete<T>(keyInput: unknown, loader: () => Promise<T>) {
    return CacheService.getOrSetCoalesced(this.autocompleteKey(keyInput), loader, SEARCH_CACHE.autocompleteTtlSeconds);
  }
}
