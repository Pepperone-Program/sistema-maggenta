import { getDatabasePoolStats, queryWithoutRetry } from '@database/connection';
import { SearchMetrics } from './SearchMetrics';
import { SEARCH_LIMITS } from './config';
import type {
  SearchAttributeFact,
  SearchCandidate,
  SearchFilters,
  SearchIntent,
} from '@/types/search';

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

type AttributeRow = {
  id_produto: number;
  id_attribute: number;
  attribute_key: string;
  semantic_type: SearchAttributeFact['semanticType'];
  id_option: number | null;
  option_key: string | null;
  canonical_value: string | null;
  value_boolean: number | null;
  value_number: string | number | null;
  value_text: string | null;
  unit: string | null;
  conflicting_option_id: number | null;
};

const placeholders = (values: unknown[]): string => values.map(() => '?').join(',');

const buildFilters = (filters: SearchFilters): { sql: string; values: unknown[] } => {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.categoryId) {
    clauses.push('EXISTS (SELECT 1 FROM aux_categorias_produtos acp WHERE acp.id_empresa = d.id_empresa AND acp.id_produto = d.id_produto AND acp.id_categoria = ?)');
    values.push(filters.categoryId);
  }
  if (filters.subcategoryId) {
    clauses.push('EXISTS (SELECT 1 FROM aux_subcategorias_produtos asp WHERE asp.id_empresa = d.id_empresa AND asp.id_produto = d.id_produto AND asp.id_subcategoria = ?)');
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
    clauses.push('EXISTS (SELECT 1 FROM aux_produtos_cores apc WHERE apc.id_empresa = d.id_empresa AND apc.id_produto = d.id_produto AND apc.cor = ?)');
    values.push(filters.color);
  }
  if (filters.recordingTypeId) {
    clauses.push('EXISTS (SELECT 1 FROM aux_produtos_tipos_gravacoes aptg WHERE aptg.id_empresa = d.id_empresa AND aptg.id_produto = d.id_produto AND aptg.id_tipo_gravacao = ?)');
    values.push(filters.recordingTypeId);
  }
  if (filters.maximumMinimumQuantity !== undefined) {
    clauses.push('COALESCE(p.quantidade_minima, 0) <= ?');
    values.push(filters.maximumMinimumQuantity);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', values };
};

const signalSelect = (score: number, extraColumns = '0 AS fulltext_name_score, 0 AS fulltext_text_score'): string =>
  `SELECT d.id_produto, ${score} AS retrieval_score, ${extraColumns}
   FROM product_search_documents d
   WHERE d.id_empresa = ? AND d.site = 'S' AND d.habilitado = 'S'`;

export class CandidateRetriever {
  static async retrieve(
    empresaId: number,
    intent: SearchIntent,
    filters: SearchFilters,
    candidateLimit = SEARCH_LIMITS.candidatePool
  ): Promise<{ candidates: SearchCandidate[]; databaseTimeMs: number }> {
    const startedAt = Date.now();
    const signals: string[] = [];
    const values: unknown[] = [];
    const prefix = `${intent.productType?.canonicalValue || intent.positiveTerms[0] || intent.comparable}%`;

    signals.push(`${signalSelect(500)} AND d.normalized_name LIKE ?`);
    values.push(empresaId, prefix);

    if (intent.productType) {
      signals.push(`${signalSelect(1000)} AND d.id_tipo_produto = ?`);
      values.push(empresaId, intent.productType.id);
      signals.push(`SELECT d.id_produto, 450 AS retrieval_score, 0 AS fulltext_name_score, 0 AS fulltext_text_score
        FROM product_search_contains_types pct
        INNER JOIN product_search_documents d ON d.id_empresa = pct.id_empresa AND d.id_produto = pct.id_produto
        WHERE d.id_empresa = ? AND d.site = 'S' AND d.habilitado = 'S' AND pct.id_tipo_produto = ?`);
      values.push(empresaId, intent.productType.id);
    }

    for (const constraint of intent.constraints.slice(0, SEARCH_LIMITS.maxParsedAttributes)) {
      if (!constraint.attributeId) continue;
      const optionClause = constraint.optionId ? ' AND psa.id_option = ?' : '';
      signals.push(`SELECT d.id_produto, 600 AS retrieval_score, 0 AS fulltext_name_score, 0 AS fulltext_text_score
        FROM product_search_attributes psa
        INNER JOIN product_search_documents d ON d.id_empresa = psa.id_empresa AND d.id_produto = psa.id_produto
        WHERE d.id_empresa = ? AND d.site = 'S' AND d.habilitado = 'S' AND psa.id_attribute = ?${optionClause}`);
      values.push(empresaId, constraint.attributeId);
      if (constraint.optionId) values.push(constraint.optionId);
    }

    const fulltextSignal = (column: 'normalized_name' | 'search_text', booleanQuery: string, score: number): void => {
      if (!booleanQuery) return;
      const scoreColumn = column === 'normalized_name' ? 'fulltext_name_score' : 'fulltext_text_score';
      const otherColumn = column === 'normalized_name' ? '0 AS fulltext_text_score' : '0 AS fulltext_name_score';
      signals.push(`SELECT ft.id_produto, ${score} + LEAST(ft.ft_score, 8) * 10 AS retrieval_score,
        ${column === 'normalized_name' ? `ft.ft_score AS ${scoreColumn}, ${otherColumn}` : `${otherColumn}, ft.ft_score AS ${scoreColumn}`}
        FROM (
          SELECT d.id_produto, MATCH(d.${column}) AGAINST (? IN BOOLEAN MODE) AS ft_score
          FROM product_search_documents d
          WHERE d.id_empresa = ? AND d.site = 'S' AND d.habilitado = 'S'
            AND MATCH(d.${column}) AGAINST (? IN BOOLEAN MODE)
        ) ft WHERE ft.ft_score > 0`);
      values.push(booleanQuery, empresaId, booleanQuery);
    };
    fulltextSignal('normalized_name', intent.safeBooleanQuery, 850);
    fulltextSignal('search_text', intent.safeBooleanQuery, 650);
    if (intent.relaxedBooleanQuery !== intent.safeBooleanQuery) {
      fulltextSignal('normalized_name', intent.relaxedBooleanQuery, 400);
      fulltextSignal('search_text', intent.relaxedBooleanQuery, 250);
    }

    const filter = buildFilters(filters);
    const sql = `SET STATEMENT max_statement_time=${SEARCH_LIMITS.statementTimeoutSeconds} FOR
      SELECT aggregated.id_produto,
             aggregated.fulltext_name_score,
             aggregated.fulltext_text_score
      FROM (
        SELECT id_produto,
               MAX(retrieval_score) AS retrieval_score,
               MAX(fulltext_name_score) AS fulltext_name_score,
               MAX(fulltext_text_score) AS fulltext_text_score
        FROM (${signals.join(' UNION ALL ')}) signals
        GROUP BY id_produto
      ) aggregated
      INNER JOIN product_search_documents d ON d.id_empresa = ? AND d.id_produto = aggregated.id_produto
      INNER JOIN produtos p ON p.id_empresa = d.id_empresa AND p.id_produto = d.id_produto
      WHERE d.site = 'S' AND d.habilitado = 'S'${filter.sql}
      ORDER BY aggregated.retrieval_score DESC, aggregated.id_produto DESC
      LIMIT ?`;
    const signalRows = (await queryWithoutRetry(sql, [...values, empresaId, ...filter.values, candidateLimit])) as CandidateSignalRow[];
    const candidates = await this.hydrate(empresaId, signalRows);
    const pool = getDatabasePoolStats();
    SearchMetrics.gauge('database_pool_active_connections', pool.active);
    SearchMetrics.gauge('database_pool_queued_requests', pool.queued);
    SearchMetrics.gauge('database_pool_saturation_ratio', pool.active / pool.connectionLimit);
    return { candidates, databaseTimeMs: Date.now() - startedAt };
  }

  private static async hydrate(empresaId: number, signals: CandidateSignalRow[]): Promise<SearchCandidate[]> {
    if (signals.length === 0) return [];
    const ids = signals.map((row) => Number(row.id_produto));
    const idSql = placeholders(ids);
    const [products, attributeRows, containsRows, colorRows] = await Promise.all([
      queryWithoutRetry(
        `SET STATEMENT max_statement_time=${SEARCH_LIMITS.statementTimeoutSeconds} FOR
         SELECT p.*, d.normalized_name, d.popularity_score
         FROM produtos p
         INNER JOIN product_search_documents d ON d.id_empresa = p.id_empresa AND d.id_produto = p.id_produto
         WHERE p.id_empresa = ? AND p.site = 'S' AND p.habilitado = 'S' AND p.id_produto IN (${idSql})`,
        [empresaId, ...ids]
      ),
      queryWithoutRetry(
        `SELECT psa.id_produto, psa.id_attribute, sad.attribute_key, sad.semantic_type,
                psa.id_option, sao.option_key, sao.canonical_value, psa.value_boolean,
                psa.value_number, psa.value_text, psa.unit, sac.conflicting_option_id
         FROM product_search_attributes psa
         INNER JOIN search_attribute_definitions sad ON sad.id_empresa = psa.id_empresa AND sad.id_attribute = psa.id_attribute
         LEFT JOIN search_attribute_options sao ON sao.id_empresa = psa.id_empresa AND sao.id_option = psa.id_option
         LEFT JOIN search_attribute_conflicts sac ON sac.id_empresa = psa.id_empresa AND sac.id_option = psa.id_option
         WHERE psa.id_empresa = ? AND psa.id_produto IN (${idSql})`,
        [empresaId, ...ids]
      ),
      queryWithoutRetry(
        `SELECT id_produto, id_tipo_produto FROM product_search_contains_types
         WHERE id_empresa = ? AND id_produto IN (${idSql})`,
        [empresaId, ...ids]
      ),
      queryWithoutRetry(
        `SELECT id_produto, cor FROM aux_produtos_cores
         WHERE id_empresa = ? AND id_produto IN (${idSql})`,
        [empresaId, ...ids]
      ),
    ]);
    const signalsById = new Map(signals.map((row) => [Number(row.id_produto), row]));
    const attributesByProduct = new Map<number, Map<number, SearchAttributeFact>>();
    for (const row of attributeRows as AttributeRow[]) {
      const productMap = attributesByProduct.get(Number(row.id_produto)) || new Map<number, SearchAttributeFact>();
      const attributeId = Number(row.id_attribute);
      const existing = productMap.get(attributeId);
      if (existing && row.conflicting_option_id !== null) {
        existing.conflictingOptionIds.push(Number(row.conflicting_option_id));
      } else if (!existing) {
        productMap.set(attributeId, {
          attributeId,
          attributeKey: row.attribute_key,
          semanticType: row.semantic_type,
          optionId: row.id_option === null ? null : Number(row.id_option),
          optionKey: row.option_key,
          canonicalValue: row.canonical_value,
          booleanValue: row.value_boolean === null ? null : Boolean(row.value_boolean),
          numberValue: row.value_number === null ? null : Number(row.value_number),
          textValue: row.value_text,
          unit: row.unit,
          conflictingOptionIds: row.conflicting_option_id === null ? [] : [Number(row.conflicting_option_id)],
        });
      }
      attributesByProduct.set(Number(row.id_produto), productMap);
    }
    const containsByProduct = new Map<number, number[]>();
    for (const row of containsRows as Array<{ id_produto: number; id_tipo_produto: number }>) {
      const list = containsByProduct.get(Number(row.id_produto)) || [];
      list.push(Number(row.id_tipo_produto));
      containsByProduct.set(Number(row.id_produto), list);
    }
    const colorsByProduct = new Map<number, string[]>();
    for (const row of colorRows as Array<{ id_produto: number; cor: string }>) {
      const list = colorsByProduct.get(Number(row.id_produto)) || [];
      list.push(row.cor);
      colorsByProduct.set(Number(row.id_produto), list);
    }

    return (products as ProductRow[]).map((row) => {
      const idProduto = Number(row.id_produto);
      const signal = signalsById.get(idProduto);
      return {
        rawProduct: row as unknown as import('@/types/produto').Produto,
        idEmpresa: Number(row.id_empresa),
        idProduto,
        idTipoProduto: row.id_tipo_produto === null ? null : Number(row.id_tipo_produto),
        produto: row.produto,
        normalizedName: row.normalized_name,
        descricao: row.descricao,
        codigo: row.codigo,
        imagem: row.imagem,
        altura: row.altura,
        largura: row.largura,
        profundidade: row.profundidade,
        peso: row.peso,
        ncm: row.ncm,
        quantidadeMinima: row.quantidade_minima === null ? null : Number(row.quantidade_minima),
        dataInclusao: row.data_inclusao instanceof Date ? row.data_inclusao.toISOString() : row.data_inclusao,
        obs: row.obs,
        lancamento: row.lancamento,
        promocao: row.promocao,
        premium: row.premium,
        popularidade: Number(row.popularity_score || 0),
        fulltextNameScore: Number(signal?.fulltext_name_score || 0),
        fulltextTextScore: Number(signal?.fulltext_text_score || 0),
        containsTypeIds: containsByProduct.get(idProduto) || [],
        colors: colorsByProduct.get(idProduto) || [],
        attributes: Array.from(attributesByProduct.get(idProduto)?.values() || []),
      };
    });
  }
}
