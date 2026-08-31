import '../module-alias';
import dataset from '@search/golden-dataset.v1.json';
import { closeDatabasePool } from '@database/connection';
import { ProductSearchService } from '@search/ProductSearchService';

const dcg = (relevance: number[]): number => relevance.reduce(
  (sum, value, index) => sum + value / Math.log2(index + 2), 0
);

type GoldenRow = {
  query: string;
  top20: string[];
  relatedTop10: string[];
  mrr: number;
  ndcg10: number;
  precision10: number;
  recall20: number;
  constraintViolations: string[];
  timing: { parseTimeMs: number; databaseTimeMs: number; rankingTimeMs: number; totalTimeMs: number };
};

const run = async (): Promise<void> => {
  const empresaId = Number(process.argv[2] || process.env.SEARCH_GOLDEN_EMPRESA_ID);
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error('Informe o tenant: npm run search:golden -- <empresaId>');
  const rows: GoldenRow[] = [];
  for (const item of dataset) {
    const response = await ProductSearchService.search({
      empresaId, term: item.query, page: 1, limit: 20, sort: 'relevance', filters: {}, locale: 'pt-BR', forceAdvanced: true,
    });
    if (response.match_exato_codigo) throw new Error(`Consulta golden interpretada como codigo: ${item.query}`);
    const codes = response.items.map((product) => product.codigo);
    const relatedCodes = response.relatedItems.map((product) => product.codigo);
    const evaluationCodes = Array.from(new Set([...codes.slice(0, 15), ...relatedCodes.slice(0, 5)])).slice(0, 20);
    const expected = new Set(item.expectedCodes);
    const relevance10: number[] = codes.slice(0, 10).map((code) => expected.has(code) ? 1 : 0);
    const ideal10: number[] = Array.from({ length: Math.min(expected.size, 10) }, () => 1);
    const firstRelevant = evaluationCodes.findIndex((code) => expected.has(code));
    const hits20 = new Set(evaluationCodes.filter((code) => expected.has(code))).size;
    rows.push({
      query: item.query,
      top20: codes.slice(0, 20),
      relatedTop10: relatedCodes.slice(0, 10),
      mrr: firstRelevant < 0 ? 0 : 1 / (firstRelevant + 1),
      ndcg10: ideal10.length ? dcg(relevance10) / dcg(ideal10) : 1,
      precision10: relevance10.reduce((sum, value) => sum + value, 0) / 10,
      recall20: expected.size ? hits20 / expected.size : 1,
      constraintViolations: evaluationCodes.filter((code) => item.forbiddenCodes.includes(code)),
      timing: response.timing,
    });
  }
  const average = (key: 'mrr' | 'ndcg10' | 'precision10' | 'recall20'): number =>
    rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
  const report = { version: 1, empresaId, queries: rows, aggregate: {
    mrr: average('mrr'), ndcg10: average('ndcg10'), precision10: average('precision10'), recall20: average('recall20'),
    constraintViolations: rows.reduce((sum, row) => sum + row.constraintViolations.length, 0),
  } };
  console.log(JSON.stringify(report, null, 2));
  if (report.aggregate.constraintViolations > 0 || report.aggregate.recall20 < Number(process.env.SEARCH_GOLDEN_MIN_RECALL20 || 0.5)) process.exitCode = 2;
};

run().catch((error) => { console.error('[search:golden]', error); process.exitCode = 1; }).finally(() => closeDatabasePool());
