import type { RankedSearchCandidate, SearchOrderTuple, SearchSort } from '@/types/search';

export const searchOrderTuple = (item: RankedSearchCandidate): SearchOrderTuple => ({
  complete: Number(item.lexical.complete),
  matchedTerms: item.lexical.matchedTerms.length,
  exactTitle: Number(item.lexical.exactTitle),
  titleExactTerms: item.lexical.titleExactTerms.length,
  titlePrefixTerms: item.lexical.titlePrefixTerms.length,
  titleSequence: Number(item.lexical.titleSequence),
  fulltextName: item.candidate.fulltextNameScore,
  fulltextText: item.candidate.fulltextTextScore,
  popularity: item.candidate.popularidade,
  newestDate: item.candidate.dataInclusao || '',
  idProduto: item.candidate.idProduto,
});

// The exact same comparator is used by ranking and cursor pagination.
export const compareSearchTuples = (
  left: SearchOrderTuple,
  right: SearchOrderTuple,
  sort: SearchSort,
): number => {
  const keys: Array<keyof SearchOrderTuple> =
    sort === 'relevance'
      ? [
          'matchedTerms',
          'exactTitle',
          'titleExactTerms',
          'titlePrefixTerms',
          'titleSequence',
          'fulltextName',
          'fulltextText',
          'popularity',
          'idProduto',
        ]
      : [
          'complete',
          sort === 'newest' ? 'newestDate' : 'popularity',
          'matchedTerms',
          'exactTitle',
          'titleExactTerms',
          'titlePrefixTerms',
          'titleSequence',
          'fulltextName',
          'fulltextText',
          'popularity',
          'idProduto',
        ];
  for (const key of keys) {
    if (left[key] !== right[key]) return left[key] > right[key] ? -1 : 1;
  }
  return 0;
};
