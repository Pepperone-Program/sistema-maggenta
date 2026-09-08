import { getDatabasePoolStats, queryWithoutRetry } from '@database/connection';
import { SearchMetrics } from './SearchMetrics';
import { SEARCH_LIMITS } from './config';
import type { SearchCandidate, SearchFilters, SearchIntent } from '@/types/search';

type CandidateSignalRow = {
  id_produto: number;
  fulltext_name_score: string | number;
  fulltext_text_score: string | number;
};

type ProductRow = {
  [key: string]: unknown;
  id_empresa: number;
  id_produto: number;
  id_tipo_produto: number | null;
  produto: string;
  normalized_name: string;
  search_text: string;
  descricao: string | null;
  codigo: string;
  imagem: string | null;
  altura: string | null;
  largura: string | null;
  profundidade: string | null;
  peso: string | null;
  ncm: string | null;
  quantidade_minima: number | null;
  data_inclusao: string | Date | null;
  obs: string | null;
  lancamento: string;
  promocao: string;
  premium: string;
  popularity_score: string | number;
};

const buildFilters = (filters: SearchFilters): { sql: string; values: unknown[] } => {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.categoryId) {
    clauses.push(
      'EXISTS (SELECT 1 FROM aux_categorias_produtos acp WHERE acp.id_empresa = d.id_empresa AND acp.id_produto = d.id_produto AND acp.id_categoria = ?)',
    );
    values.push(filters.categoryId);
  }
  if (filters.subcategoryId) {
    clauses.push(
      'EXISTS (SELECT 1 FROM aux_subcategorias_produtos asp WHERE asp.id_empresa = d.id_empresa AND asp.id_produto = d.id_produto AND asp.id_subcategoria = ?)',
    );
    values.push(filters.subcategoryId);
  }
  if (filters.productTypeId) {
    clauses.push('d.id_tipo_produto = ?');
    values.push(filters.productTypeId);
  }
  if (filters.material) {
    clauses.push(`EXISTS (
      SELECT 1 FROM product_search_attributes psa
      INNER JOIN search_attribute_definitions sad ON sad.id_attribute = psa.id_attribute AND sad.id_empresa = psa.id_empresa
      LEFT JOIN search_attribute_options sao ON sao.id_option = psa.id_option AND sao.id_empresa = psa.id_empresa
      WHERE psa.id_empresa = d.id_empresa AND psa.id_produto = d.id_produto
        AND sad.semantic_type = 'MATERIAL' AND (
          sao.option_key = ? OR sao.canonical_value = ? OR sao.id_option IN (
            SELECT sd.id_option FROM search_dictionary sd
            WHERE sd.id_empresa = d.id_empresa AND sd.active = 1
              AND sd.term_type = 'MATERIAL' AND sd.normalized_term = ?
          )
        )
    )`);
    values.push(filters.material, filters.material, filters.material);
  }
  if (filters.color) {
    clauses.push(
      'EXISTS (SELECT 1 FROM aux_produtos_cores apc WHERE apc.id_empresa = d.id_empresa AND apc.id_produto = d.id_produto AND apc.cor = ?)',
    );
    values.push(filters.color);
  }
  if (filters.recordingTypeId) {
    clauses.push(
      'EXISTS (SELECT 1 FROM aux_produtos_tipos_gravacoes aptg WHERE aptg.id_empresa = d.id_empresa AND aptg.id_produto = d.id_produto AND aptg.id_tipo_gravacao = ?)',
    );
    values.push(filters.recordingTypeId);
  }
  if (filters.maximumMinimumQuantity !== undefined) {
    clauses.push('COALESCE(p.quantidade_minima, 0) <= ?');
    values.push(filters.maximumMinimumQuantity);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', values };
};

export class CandidateRetriever {
  static async retrieve(
    empresaId: number,
    intent: SearchIntent,
    filters: SearchFilters,
  ): Promise<{ candidates: SearchCandidate[]; databaseTimeMs: number }> {
    const startedAt = Date.now();
    const signals: string[] = [];
    const values: unknown[] = [];
    const fulltextSignal = (column: 'normalized_name' | 'search_text', booleanQuery: string): void => {
      if (!booleanQuery) return;
      const scoreColumn = column === 'normalized_name' ? 'fulltext_name_score' : 'fulltext_text_score';
      const otherColumn =
        column === 'normalized_name' ? '0 AS fulltext_text_score' : '0 AS fulltext_name_score';
      signals.push(`SELECT ft.id_produto, ${column === 'normalized_name' ? `ft.ft_score AS ${scoreColumn}, ${otherColumn}` : `${otherColumn}, ft.ft_score AS ${scoreColumn}`}
        FROM (
          SELECT d.id_produto, MATCH(d.${column}) AGAINST (? IN BOOLEAN MODE) AS ft_score
          FROM product_search_documents d
          WHERE d.id_empresa = ? AND d.site = 'S' AND d.habilitado = 'S'
            AND MATCH(d.${column}) AGAINST (? IN BOOLEAN MODE)
        ) ft WHERE ft.ft_score > 0`);
      values.push(booleanQuery, empresaId, booleanQuery);
    };
    fulltextSignal('normalized_name', intent.safeBooleanQuery);
    fulltextSignal('search_text', intent.safeBooleanQuery);
    const filter = buildFilters(filters);
    const sql = `SET STATEMENT max_statement_time=${SEARCH_LIMITS.statementTimeoutSeconds} FOR
      SELECT p.id_empresa, p.id_produto, p.id_tipo_produto, p.produto, p.codigo, p.data_inclusao,
             d.normalized_name, d.search_text, d.popularity_score,
             aggregated.fulltext_name_score,
             aggregated.fulltext_text_score
      FROM (
        SELECT id_produto,
               MAX(fulltext_name_score) AS fulltext_name_score,
               MAX(fulltext_text_score) AS fulltext_text_score
        FROM (${signals.join(' UNION ALL ')}) signals
        GROUP BY id_produto
      ) aggregated
      INNER JOIN product_search_documents d ON d.id_empresa = ? AND d.id_produto = aggregated.id_produto
      INNER JOIN produtos p ON p.id_empresa = d.id_empresa AND p.id_produto = d.id_produto
      WHERE d.site = 'S' AND d.habilitado = 'S' AND p.site = 'S' AND p.habilitado = 'S'${filter.sql}
`;
    const signalRows = (await queryWithoutRetry(sql, [...values, empresaId, ...filter.values])) as Array<
      CandidateSignalRow & ProductRow
    >;
    const candidates = this.hydrateLexical(signalRows);
    const pool = getDatabasePoolStats();
    SearchMetrics.gauge('database_pool_active_connections', pool.active);
    SearchMetrics.gauge('database_pool_queued_requests', pool.queued);
    SearchMetrics.gauge('database_pool_saturation_ratio', pool.active / pool.connectionLimit);
    return { candidates, databaseTimeMs: Date.now() - startedAt };
  }

  private static hydrateLexical(rows: Array<CandidateSignalRow & ProductRow>): SearchCandidate[] {
    return rows.map((row) => {
      return {
        rawProduct: {
          id_empresa: row.id_empresa,
          id_produto: row.id_produto,
          id_tipo_produto: row.id_tipo_produto,
          produto: row.produto,
          codigo: row.codigo,
        } as unknown as import('@/types/produto').Produto,
        idEmpresa: Number(row.id_empresa),
        idProduto: Number(row.id_produto),
        idTipoProduto: row.id_tipo_produto === null ? null : Number(row.id_tipo_produto),
        produto: row.produto,
        normalizedName: row.normalized_name,
        searchText: row.search_text,
        descricao: null,
        codigo: row.codigo,
        imagem: null,
        altura: null,
        largura: null,
        profundidade: null,
        peso: null,
        ncm: null,
        quantidadeMinima: null,
        dataInclusao: row.data_inclusao instanceof Date ? row.data_inclusao.toISOString() : row.data_inclusao,
        obs: null,
        lancamento: 'N',
        promocao: 'N',
        premium: 'N',
        popularidade: Number(row.popularity_score || 0),
        fulltextNameScore: Number(row.fulltext_name_score || 0),
        fulltextTextScore: Number(row.fulltext_text_score || 0),
        containsTypeIds: [],
        colors: [],
        attributes: [],
      } as SearchCandidate;
    });
  }
}
