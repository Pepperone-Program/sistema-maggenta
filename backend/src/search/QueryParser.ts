import { SEARCH_LIMITS } from './config';
import { QueryTokenizer } from './QueryTokenizer';
import type {
  NormalizedSearchQuery,
  ParsedAttribute,
  SearchConstraint,
  SearchDictionaryEntry,
  SearchIntent,
  SearchSemanticType,
} from '@/types/search';

const STOPWORDS = new Set(['a', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'o', 'os', 'para', 'por']);
const CODE_OR_NUMBER = /\d|^[a-z]{1,3}\d/i;

const levenshtein = (left: string, right: string): number => {
  const rows = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));
  for (let index = 0; index <= left.length; index += 1) rows[index][0] = index;
  for (let index = 0; index <= right.length; index += 1) rows[0][index] = index;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
  }
  return rows[left.length][right.length];
};

const measurementConstraints = (query: NormalizedSearchQuery, dictionary: SearchDictionaryEntry[]): SearchConstraint[] => {
  const constraints: SearchConstraint[] = [];
  const attributeId = (key: string): number | undefined => dictionary.find(
    (entry) => entry.attributeId && entry.canonicalValue === key
  )?.attributeId || undefined;
  const text = query.comparable.replace(/(\d),(\d)/g, '$1.$2');
  const capacityPattern = /(\d+(?:\.\d+)?)\s*(ml|mililitros?|l|litros?)\b/g;
  const weightPattern = /(\d+(?:\.\d+)?)\s*(g|gramas?|kg|quilos?)\b/g;
  const lengthPattern = /(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/g;
  const inchesPattern = /(\d+(?:\.\d+)?)\s*(?:"(?=\s|$)|polegadas?\b)/g;

  for (const match of text.matchAll(capacityPattern)) {
    const raw = Number(match[1]);
    const value = /^l/.test(match[2]) ? raw * 1000 : raw;
    constraints.push({ kind: 'MEASUREMENT', key: 'capacity_ml', attributeId: attributeId('capacity_ml'), canonicalValue: String(value), expectedNumber: value, unit: 'ml', strength: 'STRONG', confidence: 1, explicitNegation: false });
  }
  for (const match of text.matchAll(weightPattern)) {
    const raw = Number(match[1]);
    const value = /^kg|^quilo/.test(match[2]) ? raw * 1000 : raw;
    constraints.push({ kind: 'MEASUREMENT', key: 'weight_g', attributeId: attributeId('weight_g'), canonicalValue: String(value), expectedNumber: value, unit: 'g', strength: 'STRONG', confidence: 1, explicitNegation: false });
  }
  for (const match of text.matchAll(lengthPattern)) {
    const raw = Number(match[1]);
    const multiplier = match[2] === 'm' ? 1000 : match[2] === 'cm' ? 10 : 1;
    constraints.push({ kind: 'MEASUREMENT', key: 'length_mm', attributeId: attributeId('length_mm'), canonicalValue: String(raw * multiplier), expectedNumber: raw * multiplier, unit: 'mm', strength: 'SOFT', confidence: 0.8, explicitNegation: false });
  }
  for (const match of text.matchAll(inchesPattern)) {
    const value = Number(match[1]);
    constraints.push({ kind: 'MEASUREMENT', key: 'screen_inches', attributeId: attributeId('screen_inches'), canonicalValue: String(value), expectedNumber: value, unit: 'in', strength: 'STRONG', confidence: 1, explicitNegation: false });
  }

  return constraints;
};

const semanticType = (entry: SearchDictionaryEntry): SearchSemanticType | 'COLOR' => {
  if (entry.termType === 'MATERIAL') return 'MATERIAL';
  if (entry.termType === 'COLOR') return 'COLOR';
  return 'ATTRIBUTE';
};

const toParsedAttribute = (entry: SearchDictionaryEntry): ParsedAttribute => ({
  kind: semanticType(entry),
  key: entry.canonicalValue,
  canonicalValue: entry.canonicalValue,
  attributeId: entry.attributeId || undefined,
  optionId: entry.optionId || undefined,
  strength: entry.termType === 'NEGATION' ? 'HARD' : 'STRONG',
  confidence: entry.confidence,
  explicitNegation: entry.termType === 'NEGATION' || entry.normalizedTerm.startsWith('sem '),
  phrase: entry.normalizedTerm,
});

export class QueryParser {
  static parse(query: NormalizedSearchQuery, dictionary: SearchDictionaryEntry[]): SearchIntent {
    const sortedEntries = [...dictionary]
      .filter((entry) => entry.normalizedTerm)
      .sort((left, right) => right.tokenCount - left.tokenCount || right.priority - left.priority);
    const matchedEntries: SearchDictionaryEntry[] = [];
    const matchedTokenIndexes = new Set<number>();
    let matchedPhraseCount = 0;

    for (const entry of sortedEntries) {
      const phraseTokens = entry.normalizedTerm.split(' ');
      if (phraseTokens.length > 1 && matchedPhraseCount >= SEARCH_LIMITS.maxPhrases) continue;
      for (let index = 0; index <= query.tokens.length - phraseTokens.length; index += 1) {
        const indexes = phraseTokens.map((_token, offset) => index + offset);
        if (indexes.some((tokenIndex) => matchedTokenIndexes.has(tokenIndex))) continue;
        if (phraseTokens.every((token, offset) => query.tokens[index + offset] === token)) {
          matchedEntries.push(entry);
          if (phraseTokens.length > 1) matchedPhraseCount += 1;
          indexes.forEach((tokenIndex) => matchedTokenIndexes.add(tokenIndex));
          break;
        }
      }
    }

    const productTypeEntry = matchedEntries
      .filter((entry) => entry.termType === 'PRODUCT_TYPE' && entry.productTypeId)
      .sort((left, right) => right.confidence - left.confidence || right.priority - left.priority)[0];
    const semanticEntries = matchedEntries
      .filter((entry) => ['ATTRIBUTE', 'PHRASE', 'NEGATION', 'MATERIAL', 'COLOR'].includes(entry.termType))
      .slice(0, SEARCH_LIMITS.maxParsedAttributes);
    const attributeEntries = semanticEntries.filter((entry) => ['ATTRIBUTE', 'PHRASE', 'NEGATION'].includes(entry.termType));
    const materialEntries = semanticEntries.filter((entry) => entry.termType === 'MATERIAL');
    const colorEntries = semanticEntries.filter((entry) => entry.termType === 'COLOR');
    const parsedAttributes = attributeEntries.map(toParsedAttribute);
    const parsedMaterials = materialEntries.map(toParsedAttribute);
    const measurements = measurementConstraints(query, dictionary)
      .slice(0, Math.max(SEARCH_LIMITS.maxParsedAttributes - semanticEntries.length, 0));
    const directUnknown = query.tokens.filter(
      (token, index) => !matchedTokenIndexes.has(index) && !STOPWORDS.has(token) && !/^\d+(?:[.,]\d+)?(?:ml|l|mm|cm|m|g|kg)?$/.test(token)
    );
    const vocabulary = Array.from(new Set(dictionary.map((entry) => entry.normalizedTerm).filter((term) => !term.includes(' '))));
    const correctedTerms = directUnknown.map((token) => {
      if (token.length < 4 || CODE_OR_NUMBER.test(token) || vocabulary.includes(token)) return token;
      const matches = vocabulary
        .map((term) => ({ term, distance: levenshtein(token, term) }))
        .filter((item) => item.distance <= 2)
        .sort((left, right) => left.distance - right.distance || left.term.localeCompare(right.term));
      return matches.length === 1 || (matches[0] && matches[1] && matches[0].distance < matches[1].distance)
        ? matches[0].term
        : token;
    });
    const synonymTerms = matchedEntries
      .filter((entry) => entry.termType === 'SYNONYM' && entry.relationType === 'EXACT_SYNONYM')
      .flatMap((entry) => [entry.normalizedTerm, entry.canonicalValue]);
    const matchedLexicalTerms = matchedEntries
      .flatMap((entry) => entry.normalizedTerm.split(/\s+/))
      .filter((token) => !STOPWORDS.has(token));
    const measurementLexicalTerms = query.tokens.filter((token) =>
      /^\d+(?:[.,]\d+)?(?:ml|l|mm|cm|m|g|kg)$/.test(token)
    );
    const positiveTerms = QueryTokenizer.safeTokens([
      ...correctedTerms,
      ...matchedLexicalTerms,
      ...measurementLexicalTerms,
      ...synonymTerms,
      ...(productTypeEntry ? [productTypeEntry.canonicalValue] : []),
    ]);
    const constraints: SearchConstraint[] = [
      ...parsedAttributes,
      ...parsedMaterials,
      ...colorEntries.map(toParsedAttribute),
      ...measurements,
    ];
    const measurementMap: SearchIntent['measurements'] = {};
    for (const constraint of measurements) {
      if (constraint.key === 'capacity_ml') measurementMap.capacityMl = constraint.expectedNumber;
      if (constraint.key === 'length_mm') measurementMap.lengthMm = constraint.expectedNumber;
      if (constraint.key === 'screen_inches') measurementMap.screenInches = constraint.expectedNumber;
      if (constraint.key === 'weight_g') measurementMap.weightGrams = constraint.expectedNumber;
    }

    return {
      original: query.original,
      normalized: query.normalized,
      comparable: query.comparable,
      productType: productTypeEntry?.productTypeId
        ? { id: productTypeEntry.productTypeId, canonicalValue: productTypeEntry.canonicalValue, confidence: productTypeEntry.confidence }
        : undefined,
      attributes: parsedAttributes,
      materials: parsedMaterials,
      colors: Array.from(new Set(colorEntries.map((entry) => entry.canonicalValue))),
      measurements: measurementMap,
      constraints,
      positiveTerms,
      negativeTerms: parsedAttributes.filter((item) => item.explicitNegation).map((item) => item.canonicalValue),
      phrases: matchedEntries.filter((entry) => entry.tokenCount > 1).map((entry) => entry.normalizedTerm),
      synonyms: synonymTerms,
      unknownTerms: correctedTerms,
      safeBooleanQuery: QueryTokenizer.buildSafeBooleanQuery(positiveTerms, true),
      relaxedBooleanQuery: QueryTokenizer.buildSafeBooleanQuery(positiveTerms, false),
    };
  }
}
