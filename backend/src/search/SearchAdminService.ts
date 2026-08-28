import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getConnection, query } from '@database/connection';
import { comparableSearchText } from './QueryNormalizer';
import { SearchDictionaryService } from './SearchDictionaryService';
import { SearchDocumentService } from './SearchDocumentService';

type Entity = 'dictionary' | 'attributes' | 'options' | 'conflicts';
type MetadataAttribute = {
  attributeId: number;
  optionId?: number | null;
  valueBoolean?: boolean | null;
  valueNumber?: number | null;
  valueText?: string | null;
  unit?: string | null;
};

const badRequest = (message: string): Error => Object.assign(new Error(message), { code: 'INVALID_SEARCH_METADATA', statusCode: 422 });
const positiveId = (value: unknown, name: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw badRequest(`${name} invalido`);
  return parsed;
};

const entityConfig = {
  dictionary: { table: 'search_dictionary', id: 'id_dictionary' },
  attributes: { table: 'search_attribute_definitions', id: 'id_attribute' },
  options: { table: 'search_attribute_options', id: 'id_option' },
  conflicts: { table: 'search_attribute_conflicts', id: 'id_option' },
} as const;

export class SearchAdminService {
  static async list(empresaId: number, entity: Entity): Promise<RowDataPacket[]> {
    const config = entityConfig[entity];
    return query(`SELECT * FROM ${config.table} WHERE id_empresa = ? ORDER BY ${config.id} ASC`, [empresaId]);
  }

  static async create(empresaId: number, entity: Entity, payload: Record<string, unknown>): Promise<RowDataPacket> {
    let sql: string;
    let values: unknown[];
    if (entity === 'dictionary') {
      const term = String(payload.term || '').trim();
      const canonical = String(payload.canonicalValue || '').trim();
      if (!term || !canonical) throw badRequest('term e canonicalValue sao obrigatorios');
      sql = `INSERT INTO search_dictionary
        (id_empresa, term, normalized_term, term_type, relation_type, canonical_value,
         id_tipo_produto, id_attribute, id_option, priority, confidence, token_count, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      values = [empresaId, term, comparableSearchText(term), payload.termType, payload.relationType || 'EXACT_SYNONYM', canonical,
        payload.productTypeId || null, payload.attributeId || null, payload.optionId || null, Number(payload.priority || 0),
        Number(payload.confidence ?? 1), comparableSearchText(term).split(/\s+/).filter(Boolean).length, payload.active === false ? 0 : 1];
    } else if (entity === 'attributes') {
      sql = `INSERT INTO search_attribute_definitions
        (id_empresa, attribute_key, label, semantic_type, value_type, canonical_unit, hard_filterable, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      values = [empresaId, payload.attributeKey, payload.label, payload.semanticType, payload.valueType,
        payload.canonicalUnit || null, payload.hardFilterable ? 1 : 0, payload.active === false ? 0 : 1];
    } else if (entity === 'options') {
      sql = `INSERT INTO search_attribute_options
        (id_empresa, id_attribute, option_key, label, canonical_value, boolean_value, active)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
      values = [empresaId, positiveId(payload.attributeId, 'attributeId'), payload.optionKey, payload.label,
        payload.canonicalValue, payload.booleanValue === undefined || payload.booleanValue === null ? null : payload.booleanValue ? 1 : 0,
        payload.active === false ? 0 : 1];
    } else {
      sql = `INSERT INTO search_attribute_conflicts
        (id_empresa, id_attribute, id_option, conflicting_option_id) VALUES (?, ?, ?, ?)`;
      values = [empresaId, positiveId(payload.attributeId, 'attributeId'), positiveId(payload.optionId, 'optionId'), positiveId(payload.conflictingOptionId, 'conflictingOptionId')];
    }
    const result = await query(sql, values) as ResultSetHeader;
    await SearchDocumentService.incrementCatalogVersion(empresaId, null, entity === 'dictionary');
    if (entity === 'dictionary') SearchDictionaryService.invalidate(empresaId);
    const id = entity === 'conflicts' ? positiveId(payload.optionId, 'optionId') : Number(result.insertId);
    return this.find(empresaId, entity, id);
  }

  static async update(empresaId: number, entity: Entity, id: number, payload: Record<string, unknown>): Promise<RowDataPacket> {
    if (entity === 'conflicts') {
      const currentConflictingId = positiveId(payload.currentConflictingOptionId, 'currentConflictingOptionId');
      const rows = await query(
        'SELECT * FROM search_attribute_conflicts WHERE id_empresa = ? AND id_option = ? AND conflicting_option_id = ? LIMIT 1',
        [empresaId, id, currentConflictingId]
      ) as RowDataPacket[];
      if (!rows[0]) throw Object.assign(new Error('Registro nao encontrado'), { code: 'SEARCH_METADATA_NOT_FOUND', statusCode: 404 });
      const attributeId = payload.attributeId === undefined ? Number(rows[0].id_attribute) : positiveId(payload.attributeId, 'attributeId');
      const optionId = payload.optionId === undefined ? id : positiveId(payload.optionId, 'optionId');
      const conflictingId = payload.conflictingOptionId === undefined ? currentConflictingId : positiveId(payload.conflictingOptionId, 'conflictingOptionId');
      await query(
        `UPDATE search_attribute_conflicts SET id_attribute = ?, id_option = ?, conflicting_option_id = ?
         WHERE id_empresa = ? AND id_option = ? AND conflicting_option_id = ?`,
        [attributeId, optionId, conflictingId, empresaId, id, currentConflictingId]
      );
      await SearchDocumentService.incrementCatalogVersion(empresaId);
      const updated = await query(
        'SELECT * FROM search_attribute_conflicts WHERE id_empresa = ? AND id_option = ? AND conflicting_option_id = ? LIMIT 1',
        [empresaId, optionId, conflictingId]
      ) as RowDataPacket[];
      return updated[0];
    }
    const allowed: Record<Exclude<Entity, 'conflicts'>, Record<string, string>> = {
      dictionary: { term: 'term', termType: 'term_type', relationType: 'relation_type', canonicalValue: 'canonical_value', productTypeId: 'id_tipo_produto', attributeId: 'id_attribute', optionId: 'id_option', priority: 'priority', confidence: 'confidence', active: 'active' },
      attributes: { attributeKey: 'attribute_key', label: 'label', semanticType: 'semantic_type', valueType: 'value_type', canonicalUnit: 'canonical_unit', hardFilterable: 'hard_filterable', active: 'active' },
      options: { attributeId: 'id_attribute', optionKey: 'option_key', label: 'label', canonicalValue: 'canonical_value', booleanValue: 'boolean_value', active: 'active' },
    };
    const updates: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(allowed[entity])) {
      if (!(key in payload)) continue;
      updates.push(`${column} = ?`);
      const value = payload[key];
      values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }
    if (entity === 'dictionary' && payload.term !== undefined) {
      updates.push('normalized_term = ?', 'token_count = ?');
      const normalized = comparableSearchText(String(payload.term));
      values.push(normalized, normalized.split(/\s+/).filter(Boolean).length);
    }
    if (!updates.length) throw badRequest('Nenhum campo mutavel informado');
    values.push(empresaId, id);
    const config = entityConfig[entity];
    const result = await query(`UPDATE ${config.table} SET ${updates.join(', ')} WHERE id_empresa = ? AND ${config.id} = ?`, values) as ResultSetHeader;
    if (!result.affectedRows) throw Object.assign(new Error('Registro nao encontrado'), { code: 'SEARCH_METADATA_NOT_FOUND', statusCode: 404 });
    await SearchDocumentService.incrementCatalogVersion(empresaId, null, entity === 'dictionary');
    if (entity === 'dictionary') SearchDictionaryService.invalidate(empresaId);
    return this.find(empresaId, entity, id);
  }

  static async remove(empresaId: number, entity: Entity, id: number, conflictingId?: number): Promise<void> {
    const config = entityConfig[entity];
    const conflict = entity === 'conflicts' ? ' AND conflicting_option_id = ?' : '';
    const values = entity === 'conflicts' ? [empresaId, id, positiveId(conflictingId, 'conflictingOptionId')] : [empresaId, id];
    const result = await query(`DELETE FROM ${config.table} WHERE id_empresa = ? AND ${config.id} = ?${conflict}`, values) as ResultSetHeader;
    if (!result.affectedRows) throw Object.assign(new Error('Registro nao encontrado'), { code: 'SEARCH_METADATA_NOT_FOUND', statusCode: 404 });
    await SearchDocumentService.incrementCatalogVersion(empresaId, null, entity === 'dictionary');
    if (entity === 'dictionary') SearchDictionaryService.invalidate(empresaId);
  }

  static async getProductMetadata(empresaId: number, produtoId: number): Promise<{ attributes: RowDataPacket[]; containsTypeIds: number[] }> {
    const [products, attributes, contains] = await Promise.all([
      query('SELECT id_produto FROM produtos WHERE id_empresa = ? AND id_produto = ? LIMIT 1', [empresaId, produtoId]),
      query(`SELECT psa.*, sad.attribute_key, sad.semantic_type, sad.value_type, sao.option_key, sao.canonical_value
             FROM product_search_attributes psa
             INNER JOIN search_attribute_definitions sad ON sad.id_empresa = psa.id_empresa AND sad.id_attribute = psa.id_attribute
             LEFT JOIN search_attribute_options sao ON sao.id_empresa = psa.id_empresa AND sao.id_option = psa.id_option
             WHERE psa.id_empresa = ? AND psa.id_produto = ? ORDER BY psa.id_attribute`, [empresaId, produtoId]),
      query('SELECT id_tipo_produto FROM product_search_contains_types WHERE id_empresa = ? AND id_produto = ? ORDER BY id_tipo_produto', [empresaId, produtoId]),
    ]);
    if (!(products as RowDataPacket[]).length) throw Object.assign(new Error('Produto nao encontrado'), { code: 'PRODUTO_NOT_FOUND', statusCode: 404 });
    return { attributes, containsTypeIds: (contains as Array<{ id_tipo_produto: number }>).map((row) => Number(row.id_tipo_produto)) };
  }

  static async replaceProductMetadata(
    empresaId: number,
    produtoId: number,
    userId: number,
    attributes: MetadataAttribute[],
    containsTypeIds: number[]
  ): Promise<{ attributes: RowDataPacket[]; containsTypeIds: number[] }> {
    if (!Array.isArray(attributes) || attributes.length > 100 || !Array.isArray(containsTypeIds) || containsTypeIds.length > 100) {
      throw badRequest('Metadados excedem o limite permitido');
    }
    const connection = await getConnection();
    try {
      await connection.beginTransaction();
      const products = await connection.execute<RowDataPacket[]>('SELECT id_produto FROM produtos WHERE id_empresa = ? AND id_produto = ? FOR UPDATE', [empresaId, produtoId]);
      if (!products[0].length) throw Object.assign(new Error('Produto nao encontrado'), { code: 'PRODUTO_NOT_FOUND', statusCode: 404 });
      await connection.execute('DELETE FROM product_search_attributes WHERE id_empresa = ? AND id_produto = ?', [empresaId, produtoId]);
      await connection.execute('DELETE FROM product_search_contains_types WHERE id_empresa = ? AND id_produto = ?', [empresaId, produtoId]);
      const seenAttributes = new Set<number>();
      for (const attribute of attributes) {
        const attributeId = positiveId(attribute.attributeId, 'attributeId');
        if (seenAttributes.has(attributeId)) throw badRequest('Cada atributo pode ser informado apenas uma vez');
        seenAttributes.add(attributeId);
        const definitions = await connection.execute<RowDataPacket[]>(
          `SELECT sad.id_attribute, sad.value_type, sad.canonical_unit
           FROM search_attribute_definitions sad
           LEFT JOIN search_attribute_options sao
             ON sao.id_empresa = sad.id_empresa AND sao.id_attribute = sad.id_attribute AND sao.id_option = ?
           WHERE sad.id_empresa = ? AND sad.id_attribute = ? AND sad.active = 1
             AND (? IS NULL OR sao.id_option IS NOT NULL) LIMIT 1`,
          [attribute.optionId || null, empresaId, attributeId, attribute.optionId || null]
        );
        if (!definitions[0].length) throw badRequest(`Atributo ou opcao invalida: ${attributeId}`);
        const definition = definitions[0][0] as { value_type: 'BOOLEAN' | 'ENUM' | 'NUMBER' | 'TEXT'; canonical_unit: string | null };
        if (definition.value_type === 'ENUM' && !attribute.optionId) throw badRequest(`O atributo ${attributeId} exige optionId`);
        if (definition.value_type === 'BOOLEAN' && attribute.valueBoolean === undefined && !attribute.optionId) throw badRequest(`O atributo ${attributeId} exige valueBoolean ou optionId`);
        if (definition.value_type === 'NUMBER' && (attribute.valueNumber === undefined || !Number.isFinite(Number(attribute.valueNumber)))) throw badRequest(`O atributo ${attributeId} exige valueNumber numerico`);
        if (definition.value_type === 'NUMBER' && definition.canonical_unit && attribute.unit !== definition.canonical_unit) throw badRequest(`O atributo ${attributeId} exige a unidade ${definition.canonical_unit}`);
        if (definition.value_type === 'TEXT' && !String(attribute.valueText || '').trim()) throw badRequest(`O atributo ${attributeId} exige valueText`);
        await connection.execute(
          `INSERT INTO product_search_attributes
           (id_empresa, id_produto, id_attribute, id_option, value_boolean, value_number, value_text, unit, source, verified_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', ?)`,
          [empresaId, produtoId, attributeId, attribute.optionId || null,
            attribute.valueBoolean === undefined || attribute.valueBoolean === null ? null : attribute.valueBoolean ? 1 : 0,
            attribute.valueNumber ?? null, attribute.valueText ?? null, attribute.unit ?? null, userId]
        );
      }
      for (const typeIdValue of Array.from(new Set(containsTypeIds))) {
        const typeId = positiveId(typeIdValue, 'containsTypeId');
        const result = await connection.execute<ResultSetHeader>(
          `INSERT INTO product_search_contains_types (id_empresa, id_produto, id_tipo_produto, verified_by)
           SELECT ?, ?, tp.id_tipo_produto, ? FROM tipos_produtos tp
           WHERE tp.id_empresa = ? AND tp.id_tipo_produto = ? LIMIT 1`,
          [empresaId, produtoId, userId, empresaId, typeId]
        );
        if (!result[0].affectedRows) throw badRequest(`Tipo contido invalido: ${typeId}`);
      }
      await SearchDocumentService.refreshProduct(empresaId, produtoId, connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return this.getProductMetadata(empresaId, produtoId);
  }

  private static async find(empresaId: number, entity: Entity, id: number): Promise<RowDataPacket> {
    const config = entityConfig[entity];
    const rows = await query(`SELECT * FROM ${config.table} WHERE id_empresa = ? AND ${config.id} = ? LIMIT 1`, [empresaId, id]) as RowDataPacket[];
    if (!rows[0]) throw Object.assign(new Error('Registro nao encontrado'), { code: 'SEARCH_METADATA_NOT_FOUND', statusCode: 404 });
    return rows[0];
  }
}
