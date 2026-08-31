export type ConstraintStrength = 'HARD' | 'STRONG' | 'SOFT';

export type SearchSemanticType =
  | 'ATTRIBUTE'
  | 'MATERIAL'
  | 'MEASUREMENT'
  | 'SIZE'
  | 'COMPOSITION';

export type SearchValueType = 'BOOLEAN' | 'ENUM' | 'NUMBER' | 'TEXT';

export type SearchDictionaryTermType =
  | 'PRODUCT_TYPE'
  | 'ATTRIBUTE'
  | 'MATERIAL'
  | 'COLOR'
  | 'SYNONYM'
  | 'PHRASE'
  | 'RELATED_TERM'
  | 'NEGATION';

export type SearchRelationType =
  | 'EXACT_SYNONYM'
  | 'RELATED_TERM'
  | 'BROADER_TERM'
  | 'NARROWER_TERM';

export interface NormalizedSearchQuery {
  original: string;
  normalized: string;
  comparable: string;
  tokens: string[];
}

export interface SearchDictionaryEntry {
  id: number;
  idEmpresa: number;
  term: string;
  normalizedTerm: string;
  termType: SearchDictionaryTermType;
  relationType: SearchRelationType;
  canonicalValue: string;
  productTypeId: number | null;
  attributeId: number | null;
  optionId: number | null;
  priority: number;
  confidence: number;
  tokenCount: number;
}

export interface SearchConstraint {
  kind: SearchSemanticType | 'COLOR';
  key: string;
  canonicalValue: string;
  attributeId?: number;
  optionId?: number;
  expectedBoolean?: boolean;
  expectedNumber?: number;
  unit?: string;
  strength: ConstraintStrength;
  confidence: number;
  explicitNegation: boolean;
}

export interface ParsedAttribute extends SearchConstraint {
  phrase: string;
}

export interface SearchIntent {
  original: string;
  normalized: string;
  comparable: string;
  productType?: {
    id: number;
    canonicalValue: string;
    confidence: number;
  };
  attributes: ParsedAttribute[];
  materials: ParsedAttribute[];
  colors: string[];
  measurements: {
    capacityMl?: number;
    lengthMm?: number;
    widthMm?: number;
    heightMm?: number;
    screenInches?: number;
    weightGrams?: number;
  };
  constraints: SearchConstraint[];
  positiveTerms: string[];
  negativeTerms: string[];
  phrases: string[];
  synonyms: string[];
  unknownTerms: string[];
  safeBooleanQuery: string;
  relaxedBooleanQuery: string;
}

export interface SearchAttributeFact {
  attributeId: number;
  attributeKey: string;
  semanticType: SearchSemanticType;
  optionId: number | null;
  optionKey: string | null;
  canonicalValue: string | null;
  booleanValue: boolean | null;
  numberValue: number | null;
  textValue: string | null;
  unit: string | null;
  conflictingOptionIds: number[];
}

export interface SearchCandidate {
  rawProduct: Produto;
  idEmpresa: number;
  idProduto: number;
  idTipoProduto: number | null;
  produto: string;
  normalizedName: string;
  descricao: string | null;
  codigo: string;
  imagem: string | null;
  altura: string | null;
  largura: string | null;
  profundidade: string | null;
  peso: string | null;
  ncm: string | null;
  quantidadeMinima: number | null;
  dataInclusao: string | null;
  obs: string | null;
  lancamento: string;
  promocao: string;
  premium: string;
  popularidade: number;
  fulltextNameScore: number;
  fulltextTextScore: number;
  containsTypeIds: number[];
  colors: string[];
  attributes: SearchAttributeFact[];
}

export interface SearchScoreBreakdown {
  productType: number;
  exactName: number;
  namePrefix: number;
  phrase: number;
  allConstraints: number;
  attributes: number;
  material: number;
  measurement: number;
  color: number;
  synonym: number;
  containsType: number;
  differentType: number;
  contradiction: number;
  lexicalCoverage: number;
  fulltextName: number;
  fulltextText: number;
  popularity: number;
  total: number;
}

export interface RankedSearchCandidate {
  candidate: SearchCandidate;
  group: 'PRIMARY' | 'RELATED';
  excluded: boolean;
  primaryTypeMatch: boolean;
  containsTypeMatch: boolean;
  matchedConstraints: number;
  totalConstraints: number;
  contradictions: number;
  score: SearchScoreBreakdown;
}

export interface SearchCursor {
  tenantId: number;
  rankingVersion: string;
  catalogVersion: number;
  queryHash: string;
  sort: SearchSort;
  last: {
    primaryTypeMatch: number;
    contradictions: number;
    matchedConstraints: number;
    group: number;
    totalScore: number;
    popularity: number;
    idProduto: number;
    newestDate: string;
  };
  expiresAt: number;
}

export interface SearchFilters {
  categoryId?: number;
  subcategoryId?: number;
  productTypeId?: number;
  material?: string;
  color?: string;
  recordingTypeId?: number;
  maximumMinimumQuantity?: number;
}

export type SearchSort = 'relevance' | 'newest' | 'popular';

export interface SearchTiming {
  parseTimeMs: number;
  databaseTimeMs: number;
  rankingTimeMs: number;
  totalTimeMs: number;
}

export interface SearchResult<T> {
  items: T[];
  relatedItems: T[];
  groups: {
    primary: T[];
    related: T[];
  };
  total: number;
  relatedTotal: number;
  page: number;
  limit: number;
  totalPages: number;
  nextCursor: string | null;
  searchId: string;
  rankingVersion: string;
  mode: 'legacy' | 'advanced';
  query: string;
  interpretedQuery: SearchIntent;
  timing: SearchTiming;
}
import type { Produto } from './produto';
