import type { SearchScoreBreakdown } from '@/types/search';

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const percentage = (value: string | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), 100);
};

export const SEARCH_LIMITS = {
  minSearchLength: 2,
  maxSearchLength: 200,
  maxTokens: 20,
  maxPhrases: 8,
  maxParsedAttributes: 12,
  defaultLimit: 20,
  maxLimit: 40,
  candidatePool: positiveInteger(process.env.SEARCH_CANDIDATE_POOL, 250),
  applicationTimeoutMs: positiveInteger(process.env.SEARCH_TIMEOUT_MS, 3000),
  statementTimeoutSeconds: 0.5,
} as const;

export const SEARCH_RANKING_VERSION = process.env.SEARCH_RANKING_VERSION || 'v2';

export const SEARCH_FLAGS = {
  rankingPercentage: percentage(process.env.SEARCH_RANKING_PERCENTAGE),
  shadowPercentage: percentage(process.env.SEARCH_SHADOW_PERCENTAGE),
  writeSyncEnabled: process.env.SEARCH_WRITE_SYNC_ENABLED === 'true',
};

export const SEARCH_CACHE = {
  resultTtlSeconds: positiveInteger(process.env.SEARCH_RESULT_CACHE_TTL_SECONDS, 60),
  autocompleteTtlSeconds: positiveInteger(process.env.SEARCH_AUTOCOMPLETE_CACHE_TTL_SECONDS, 300),
  dictionaryTtlMs: positiveInteger(process.env.SEARCH_DICTIONARY_TTL_MS, 60_000),
} as const;

export const SEARCH_SCORE_WEIGHTS: Omit<SearchScoreBreakdown, 'total'> = {
  productType: 10_000,
  exactName: 9_000,
  namePrefix: 6_000,
  phrase: 5_000,
  allConstraints: 4_000,
  attributes: 2_000,
  material: 2_000,
  measurement: 2_000,
  color: 1_000,
  synonym: 1_000,
  containsType: -3_000,
  differentType: -2_000,
  contradiction: -10_000,
  lexicalCoverage: 3_500,
  fulltextName: 800,
  fulltextText: 400,
  popularity: 100,
};
