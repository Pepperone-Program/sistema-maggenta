import { SEARCH_SCORE_WEIGHTS } from './config';
import type {
  RankedSearchCandidate,
  SearchAttributeFact,
  SearchCandidate,
  SearchConstraint,
  SearchIntent,
  SearchScoreBreakdown,
  SearchSort,
} from '@/types/search';

const normalizedScore = (score: number, cap: number): number =>
  Math.min(Math.max(score, 0) * 100, cap);

const LEXICAL_STOPWORDS = new Set(['a', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'o', 'os', 'para', 'por']);

const comparableLexicalText = (value: string): string => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/(\d),(\d)/g, '$1.$2');

const lexicalCoverage = (candidate: SearchCandidate, intent: SearchIntent): number => {
  const terms = Array.from(new Set(intent.positiveTerms
    .flatMap((term) => term.split(/\s+/))
    .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9.,]+$/g, ''))
    .filter((token) => token.length >= 2 && !LEXICAL_STOPWORDS.has(token))));
  if (terms.length === 0) return 0;
  // CandidateRetriever usa apenas a consulta booleana estrita para estes
  // scores; um score positivo comprova todos os termos obrigatorios.
  if (candidate.fulltextNameScore > 0 || candidate.fulltextTextScore > 0) return 1;
  const text = comparableLexicalText([
    candidate.normalizedName,
    candidate.descricao || '',
    candidate.obs || '',
  ].join(' '));
  const matched = terms.filter((term) => text.includes(term)).length;
  return matched / terms.length;
};

const numberMatches = (expected: number, actual: number): boolean =>
  Math.abs(expected - actual) <= Math.max(1, expected * 0.01);

const factMatches = (constraint: SearchConstraint, fact: SearchAttributeFact): boolean => {
  if (constraint.attributeId && fact.attributeId !== constraint.attributeId) return false;
  if (!constraint.attributeId && fact.attributeKey !== constraint.key) return false;
  if (constraint.optionId) return fact.optionId === constraint.optionId;
  if (constraint.expectedBoolean !== undefined) return fact.booleanValue === constraint.expectedBoolean;
  if (constraint.expectedNumber !== undefined && fact.numberValue !== null) {
    return numberMatches(constraint.expectedNumber, fact.numberValue);
  }
  return [fact.canonicalValue, fact.optionKey, fact.textValue]
    .filter(Boolean)
    .some((value) => String(value) === constraint.canonicalValue);
};

const factContradicts = (constraint: SearchConstraint, fact: SearchAttributeFact): boolean => {
  if (constraint.attributeId && fact.attributeId !== constraint.attributeId) return false;
  if (!constraint.attributeId && fact.attributeKey !== constraint.key) return false;
  if (constraint.optionId && fact.conflictingOptionIds.includes(constraint.optionId)) return true;
  if (constraint.expectedBoolean !== undefined && fact.booleanValue !== null) {
    return fact.booleanValue !== constraint.expectedBoolean;
  }
  return false;
};

const constraintState = (
  constraint: SearchConstraint,
  candidate: SearchCandidate
): 'MATCH' | 'CONTRADICTION' | 'MISSING' => {
  if (constraint.kind === 'COLOR') {
    return candidate.colors.includes(constraint.canonicalValue) ? 'MATCH' : 'MISSING';
  }
  if (candidate.attributes.some((fact) => factMatches(constraint, fact))) return 'MATCH';
  if (candidate.attributes.some((fact) => factContradicts(constraint, fact))) return 'CONTRADICTION';
  return 'MISSING';
};

const sumBreakdown = (breakdown: Omit<SearchScoreBreakdown, 'total'>): SearchScoreBreakdown => ({
  ...breakdown,
  total: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
});

export class ProductRankingEngine {
  static rankCandidate(candidate: SearchCandidate, intent: SearchIntent): RankedSearchCandidate {
    const primaryTypeMatch = Boolean(intent.productType && candidate.idTipoProduto === intent.productType.id);
    const containsTypeMatch = Boolean(intent.productType && candidate.containsTypeIds.includes(intent.productType.id));
    const normalizedCandidateName = comparableLexicalText(candidate.normalizedName);
    const productTypeNameMatch = !intent.productType || intent.productType.canonicalValue
      .split(/\s+/)
      .filter(Boolean)
      .every((term) => normalizedCandidateName.includes(term));
    const states = intent.constraints.map((constraint) => ({ constraint, state: constraintState(constraint, candidate) }));
    const matched = states.filter((item) => item.state === 'MATCH');
    const contradictions = states.filter((item) => item.state === 'CONTRADICTION');
    const hardContradiction = contradictions.some((item) => item.constraint.strength === 'HARD');
    const attributeMatches = matched.filter((item) => item.constraint.kind === 'ATTRIBUTE').length;
    const materialMatches = matched.filter((item) => item.constraint.kind === 'MATERIAL').length;
    const measurementMatches = matched.filter((item) => item.constraint.kind === 'MEASUREMENT').length;
    const colorMatches = matched.filter((item) => item.constraint.kind === 'COLOR').length;
    const exactName = candidate.normalizedName === intent.comparable;
    const namePrefix = !exactName && candidate.normalizedName.startsWith(intent.comparable);
    const phraseMatches = intent.phrases.filter((phrase) => candidate.normalizedName.includes(phrase)).length;
    const synonymMatch = intent.synonyms.some((synonym) => candidate.normalizedName.includes(synonym));
    const lexicalCoverageRatio = lexicalCoverage(candidate, intent);
    const allConstraints = intent.constraints.length > 0
      && matched.length === intent.constraints.length
      && (!intent.productType || primaryTypeMatch);
    const strongConstraintStates = states.filter((item) => item.constraint.strength !== 'SOFT');
    const strongConstraintsSatisfied = strongConstraintStates.length > 0
      && strongConstraintStates.every((item) => item.state === 'MATCH');
    const candidateText = comparableLexicalText([
      candidate.normalizedName,
      candidate.descricao || '',
      candidate.codigo || '',
      candidate.obs || '',
    ].join(' '));
    const strictFulltextMatch = candidate.fulltextNameScore > 0 || candidate.fulltextTextScore > 0;
    const unknownTermsCovered = intent.unknownTerms.length === 0
      || strictFulltextMatch
      || intent.unknownTerms.every((term) => candidateText.includes(comparableLexicalText(term)));
    const hasCompleteEvidence = lexicalCoverageRatio >= 1
      || (strongConstraintsSatisfied && unknownTermsCovered);
    const relevance = hardContradiction
      ? 'LOW'
      : intent.productType
        ? primaryTypeMatch && productTypeNameMatch && hasCompleteEvidence
          ? 'HIGH'
          : (containsTypeMatch || lexicalCoverageRatio > 0 ? 'MEDIUM' : 'LOW')
        : hasCompleteEvidence ? 'HIGH' : lexicalCoverageRatio > 0 ? 'MEDIUM' : 'LOW';

    const score = sumBreakdown({
      productType: primaryTypeMatch ? SEARCH_SCORE_WEIGHTS.productType : 0,
      exactName: exactName ? SEARCH_SCORE_WEIGHTS.exactName : 0,
      namePrefix: namePrefix ? SEARCH_SCORE_WEIGHTS.namePrefix : 0,
      phrase: phraseMatches > 0 ? SEARCH_SCORE_WEIGHTS.phrase : 0,
      allConstraints: allConstraints ? SEARCH_SCORE_WEIGHTS.allConstraints : 0,
      attributes: attributeMatches * SEARCH_SCORE_WEIGHTS.attributes,
      material: materialMatches * SEARCH_SCORE_WEIGHTS.material,
      measurement: measurementMatches * SEARCH_SCORE_WEIGHTS.measurement,
      color: colorMatches * SEARCH_SCORE_WEIGHTS.color,
      synonym: synonymMatch ? SEARCH_SCORE_WEIGHTS.synonym : 0,
      containsType: containsTypeMatch && !primaryTypeMatch ? SEARCH_SCORE_WEIGHTS.containsType : 0,
      differentType: intent.productType && !primaryTypeMatch && !containsTypeMatch ? SEARCH_SCORE_WEIGHTS.differentType : 0,
      contradiction: contradictions.length * SEARCH_SCORE_WEIGHTS.contradiction,
      lexicalCoverage: lexicalCoverageRatio * SEARCH_SCORE_WEIGHTS.lexicalCoverage,
      fulltextName: normalizedScore(candidate.fulltextNameScore, SEARCH_SCORE_WEIGHTS.fulltextName),
      fulltextText: normalizedScore(candidate.fulltextTextScore, SEARCH_SCORE_WEIGHTS.fulltextText),
      popularity: Math.min(Math.log1p(Math.max(candidate.popularidade, 0)) * 10, SEARCH_SCORE_WEIGHTS.popularity),
    });

    return {
      candidate,
      group: primaryTypeMatch || (!intent.productType && contradictions.length === 0) ? 'PRIMARY' : 'RELATED',
      relevance,
      excluded: hardContradiction,
      primaryTypeMatch,
      containsTypeMatch,
      matchedConstraints: matched.length,
      totalConstraints: intent.constraints.length,
      contradictions: contradictions.length,
      lexicalCoverageRatio,
      score,
    };
  }

  static compare(left: RankedSearchCandidate, right: RankedSearchCandidate, sort: SearchSort = 'relevance'): number {
    if (left.excluded !== right.excluded) return left.excluded ? 1 : -1;
    const relevanceOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
    if (left.relevance !== right.relevance) return relevanceOrder[left.relevance] - relevanceOrder[right.relevance];
    if (left.primaryTypeMatch !== right.primaryTypeMatch) return left.primaryTypeMatch ? -1 : 1;
    if (left.contradictions !== right.contradictions) return left.contradictions - right.contradictions;
    if (left.matchedConstraints !== right.matchedConstraints) return right.matchedConstraints - left.matchedConstraints;
    if (left.group !== right.group) return left.group === 'PRIMARY' ? -1 : 1;
    if (sort === 'newest') {
      const dateOrder = String(right.candidate.dataInclusao || '').localeCompare(String(left.candidate.dataInclusao || ''));
      if (dateOrder !== 0) return dateOrder;
    }
    if (sort === 'popular' && left.candidate.popularidade !== right.candidate.popularidade) {
      return right.candidate.popularidade - left.candidate.popularidade;
    }
    if (left.score.total !== right.score.total) return right.score.total - left.score.total;
    if (left.candidate.popularidade !== right.candidate.popularidade) return right.candidate.popularidade - left.candidate.popularidade;
    return right.candidate.idProduto - left.candidate.idProduto;
  }

  static rank(candidates: SearchCandidate[], intent: SearchIntent, sort: SearchSort = 'relevance'): RankedSearchCandidate[] {
    return candidates.map((candidate) => this.rankCandidate(candidate, intent)).sort((left, right) => this.compare(left, right, sort));
  }
}
