const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const SEARCH_LIMITS = {
  minSearchLength: 2,
  maxSearchLength: 200,
  maxTokens: 20,
  maxPhrases: 8,
  maxParsedAttributes: 12,
  defaultLimit: 20,
  maxLimit: 40,
  applicationTimeoutMs: positiveInteger(process.env.SEARCH_TIMEOUT_MS, 3000),
  statementTimeoutSeconds: 0.5,
} as const;

export const SEARCH_RANKING_VERSION = 'v5-lexical:' + (process.env.SEARCH_RANKING_VERSION || '1');

export const SEARCH_FLAGS = {
  writeSyncEnabled: process.env.SEARCH_WRITE_SYNC_ENABLED === 'true',
};

export const SEARCH_CACHE = {
  resultTtlSeconds: positiveInteger(process.env.SEARCH_RESULT_CACHE_TTL_SECONDS, 60),
  autocompleteTtlSeconds: positiveInteger(process.env.SEARCH_AUTOCOMPLETE_CACHE_TTL_SECONDS, 300),
  dictionaryTtlMs: positiveInteger(process.env.SEARCH_DICTIONARY_TTL_MS, 60_000),
  rankingPlanMaxEntries: positiveInteger(process.env.SEARCH_RANKING_PLAN_MAX_ENTRIES, 100),
} as const;
