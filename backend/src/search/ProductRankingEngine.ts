import { comparableSearchText } from './QueryNormalizer';
import { QueryTokenizer } from './QueryTokenizer';
import { compareSearchTuples, searchOrderTuple } from './SearchOrdering';
import type { RankedSearchCandidate, SearchCandidate, SearchIntent, SearchSort } from '@/types/search';

export class ProductRankingEngine {
  static rankCandidate(candidate: SearchCandidate, intent: SearchIntent): RankedSearchCandidate {
    const titleWords = QueryTokenizer.words(candidate.normalizedName);
    const documentWords = QueryTokenizer.words(candidate.searchText);
    const terms = intent.positiveTerms;
    const matches = (words: string[], term: string): boolean => words.some((word) => word.startsWith(term));
    const matchedTerms = terms.filter((term) => matches(documentWords, term) || matches(titleWords, term));
    const titleExactTerms = terms.filter((term) => titleWords.includes(term));
    const titlePrefixTerms = terms.filter((term) => matches(titleWords, term));
    const complete = terms.length > 0 && matchedTerms.length === terms.length;
    const exactTitle = comparableSearchText(candidate.normalizedName) === intent.comparable;
    const sequence = QueryTokenizer.words(intent.comparable);
    const titleSequence =
      sequence.length > 0 &&
      titleWords.some((_word, index) =>
        sequence.every((term, offset) => titleWords[index + offset]?.startsWith(term)),
      );
    const lexicalCoverageRatio = matchedTerms.length / Math.max(terms.length, 1);
    return {
      candidate,
      group: complete ? 'PRIMARY' : 'RELATED',
      relevance: complete ? 'HIGH' : matchedTerms.length ? 'MEDIUM' : 'LOW',
      excluded: false,
      primaryTypeMatch: false,
      containsTypeMatch: false,
      matchedConstraints: 0,
      totalConstraints: 0,
      contradictions: 0,
      lexicalCoverageRatio,
      lexical: {
        matchedTerms,
        titleExactTerms,
        titlePrefixTerms,
        documentOnlyTerms: matchedTerms.filter((term) => !titlePrefixTerms.includes(term)),
        complete,
        exactTitle,
        titleSequence,
      },
      // Compatibility diagnostics only; sorting uses the explicit lexical tuple.
      score: {
        productType: 0,
        exactName: Number(exactTitle),
        namePrefix: titlePrefixTerms.length,
        phrase: Number(titleSequence),
        allConstraints: 0,
        attributes: 0,
        material: 0,
        measurement: 0,
        color: 0,
        synonym: 0,
        containsType: 0,
        differentType: 0,
        contradiction: 0,
        lexicalCoverage: lexicalCoverageRatio,
        fulltextName: candidate.fulltextNameScore,
        fulltextText: candidate.fulltextTextScore,
        popularity: candidate.popularidade,
        total: matchedTerms.length,
      },
    };
  }

  static compare(
    left: RankedSearchCandidate,
    right: RankedSearchCandidate,
    sort: SearchSort = 'relevance',
  ): number {
    return compareSearchTuples(searchOrderTuple(left), searchOrderTuple(right), sort);
  }

  static rank(
    candidates: SearchCandidate[],
    intent: SearchIntent,
    sort: SearchSort = 'relevance',
  ): RankedSearchCandidate[] {
    return candidates
      .map((candidate) => this.rankCandidate(candidate, intent))
      .sort((left, right) => this.compare(left, right, sort));
  }
}
