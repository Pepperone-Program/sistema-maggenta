import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { query } from '@database/connection';
import { comparableSearchText } from './QueryNormalizer';

type Executor = PoolConnection | null;

const execute = async <T>(executor: Executor, sql: string, values: any[] = []): Promise<T> => {
  if (executor) {
    const [rows] = await executor.execute(sql, values);
    return rows as T;
  }
  return (await query(sql, values)) as T;
};

const plainText = (value: string | null): string =>
  comparableSearchText(String(value || '').replace(/<[^>]*>/g, ' ').slice(0, 2000));

export class SearchDocumentService {
  static async refreshProduct(empresaId: number, produtoId: number, connection: Executor = null, incrementVersion = true): Promise<void> {
    const products = await execute<Array<RowDataPacket & {
      id_tipo_produto: number | null;
      produto: string;
      descricao: string | null;
      obs: string | null;
      site: string;
      habilitado: string;
      tipo_produto: string | null;
      popularity_score: string | number | null;
    }>>(
      connection,
      `SELECT p.id_tipo_produto, p.produto, p.descricao, p.obs, p.site, p.habilitado,
              tp.tipo_produto, psp.popularity_score
       FROM produtos p
       LEFT JOIN tipos_produtos tp ON tp.id_empresa = p.id_empresa AND tp.id_tipo_produto = p.id_tipo_produto
       LEFT JOIN product_search_popularity psp ON psp.id_empresa = p.id_empresa AND psp.id_produto = p.id_produto
       WHERE p.id_empresa = ? AND p.id_produto = ? LIMIT 1`,
      [empresaId, produtoId]
    );
    const product = products[0];
    if (!product) return;
    const [contains, attributes, colors] = await Promise.all([
      execute<Array<RowDataPacket & { tipo_produto: string }>>(
        connection,
        `SELECT tp.tipo_produto
         FROM product_search_contains_types pct
         INNER JOIN tipos_produtos tp ON tp.id_empresa = pct.id_empresa AND tp.id_tipo_produto = pct.id_tipo_produto
         WHERE pct.id_empresa = ? AND pct.id_produto = ?`,
        [empresaId, produtoId]
      ),
      execute<Array<RowDataPacket & { attribute_key: string; option_value: string | null; value_text: string | null; value_number: string | number | null; unit: string | null }>>(
        connection,
        `SELECT sad.attribute_key, sao.canonical_value AS option_value,
                psa.value_text, psa.value_number, psa.unit
         FROM product_search_attributes psa
         INNER JOIN search_attribute_definitions sad ON sad.id_empresa = psa.id_empresa AND sad.id_attribute = psa.id_attribute
         LEFT JOIN search_attribute_options sao ON sao.id_empresa = psa.id_empresa AND sao.id_option = psa.id_option
         WHERE psa.id_empresa = ? AND psa.id_produto = ?`,
        [empresaId, produtoId]
      ),
      execute<Array<RowDataPacket & { cor: string }>>(
        connection,
        'SELECT cor FROM aux_produtos_cores WHERE id_empresa = ? AND id_produto = ?',
        [empresaId, produtoId]
      ),
    ]);
    const terms = [
      comparableSearchText(product.produto),
      comparableSearchText(product.tipo_produto || ''),
      ...contains.map((item) => comparableSearchText(item.tipo_produto)),
      ...attributes.flatMap((item) => [
        comparableSearchText(item.attribute_key),
        comparableSearchText(item.option_value || ''),
        comparableSearchText(item.value_text || ''),
        item.value_number === null ? '' : `${item.value_number} ${item.unit || ''}`.trim(),
      ]),
      ...colors.map((item) => comparableSearchText(item.cor)),
      plainText(product.descricao),
      plainText(product.obs),
    ].filter(Boolean);
    const searchText = Array.from(new Set(terms)).join(' ').slice(0, 8000);

    await execute<ResultSetHeader>(
      connection,
      `INSERT INTO product_search_documents (
         id_empresa, id_produto, id_tipo_produto, original_name, normalized_name,
         search_text, site, habilitado, popularity_score, document_version
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         id_tipo_produto = VALUES(id_tipo_produto), original_name = VALUES(original_name),
         normalized_name = VALUES(normalized_name), search_text = VALUES(search_text),
         site = VALUES(site), habilitado = VALUES(habilitado),
         popularity_score = VALUES(popularity_score), document_version = document_version + 1`,
      [
        empresaId,
        produtoId,
        product.id_tipo_produto,
        product.produto,
        comparableSearchText(product.produto),
        searchText,
        product.site,
        product.habilitado,
        Number(product.popularity_score || 0),
      ]
    );
    if (incrementVersion) await this.incrementCatalogVersion(empresaId, connection);
  }

  static async removeProduct(empresaId: number, produtoId: number, connection: Executor = null): Promise<void> {
    await execute(connection, 'DELETE FROM product_search_documents WHERE id_empresa = ? AND id_produto = ?', [empresaId, produtoId]);
    await execute(connection, 'DELETE FROM product_search_attributes WHERE id_empresa = ? AND id_produto = ?', [empresaId, produtoId]);
    await execute(connection, 'DELETE FROM product_search_contains_types WHERE id_empresa = ? AND id_produto = ?', [empresaId, produtoId]);
    await execute(connection, 'DELETE FROM product_search_popularity WHERE id_empresa = ? AND id_produto = ?', [empresaId, produtoId]);
    await this.incrementCatalogVersion(empresaId, connection);
  }

  static async incrementCatalogVersion(empresaId: number, connection: Executor = null, dictionary = false): Promise<void> {
    await execute(
      connection,
      `INSERT INTO search_catalog_versions (id_empresa, catalog_version, dictionary_version)
       VALUES (?, 2, ?)
       ON DUPLICATE KEY UPDATE catalog_version = catalog_version + 1${dictionary ? ', dictionary_version = dictionary_version + 1' : ''}`,
      [empresaId, dictionary ? 2 : 1]
    );
  }
}
