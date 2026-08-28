import '../module-alias';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { closeDatabasePool, getConnection } from '@database/connection';
import { comparableSearchText } from '@search/QueryNormalizer';

type AttributeSeed = { key: string; label: string; semantic: string; valueType: string; unit?: string };
const attributes: AttributeSeed[] = [
  { key: 'lined', label: 'Pauta', semantic: 'ATTRIBUTE', valueType: 'ENUM' },
  { key: 'double_wall', label: 'Parede dupla', semantic: 'ATTRIBUTE', valueType: 'BOOLEAN' },
  { key: 'material', label: 'Material', semantic: 'MATERIAL', valueType: 'ENUM' },
  { key: 'contains_cups', label: 'Composicao com tacas', semantic: 'COMPOSITION', valueType: 'ENUM' },
  { key: 'notebook_compatible', label: 'Compativel com notebook', semantic: 'ATTRIBUTE', valueType: 'BOOLEAN' },
  { key: 'capacity_ml', label: 'Capacidade', semantic: 'MEASUREMENT', valueType: 'NUMBER', unit: 'ml' },
  { key: 'screen_inches', label: 'Tamanho de tela', semantic: 'MEASUREMENT', valueType: 'NUMBER', unit: 'in' },
  { key: 'weight_g', label: 'Peso', semantic: 'MEASUREMENT', valueType: 'NUMBER', unit: 'g' },
  { key: 'length_mm', label: 'Comprimento', semantic: 'MEASUREMENT', valueType: 'NUMBER', unit: 'mm' },
  { key: 'size_standard', label: 'Formato padrao', semantic: 'SIZE', valueType: 'ENUM' },
  { key: 'uv_printing', label: 'Compativel com gravacao UV', semantic: 'ATTRIBUTE', valueType: 'BOOLEAN' },
];

const execute = async (connection: PoolConnection, sql: string, values: unknown[]): Promise<void> => {
  await connection.execute(sql, values as any[]);
};

const findId = async (connection: PoolConnection, table: string, id: string, empresaId: number, keyColumn: string, key: string): Promise<number> => {
  const [rows] = await connection.execute<RowDataPacket[]>(`SELECT ${id} AS id FROM ${table} WHERE id_empresa = ? AND ${keyColumn} = ? LIMIT 1`, [empresaId, key]);
  return Number(rows[0].id);
};

const upsertDictionary = async (connection: PoolConnection, empresaId: number, input: {
  term: string; type: string; canonical: string; productTypeId?: number; attributeId?: number; optionId?: number; priority?: number;
}): Promise<void> => {
  const normalized = comparableSearchText(input.term);
  await execute(connection, `INSERT INTO search_dictionary
    (id_empresa, term, normalized_term, term_type, relation_type, canonical_value,
     id_tipo_produto, id_attribute, id_option, priority, confidence, token_count, active)
    VALUES (?, ?, ?, ?, 'EXACT_SYNONYM', ?, ?, ?, ?, ?, 1.000, ?, 1)
    ON DUPLICATE KEY UPDATE id_tipo_produto = VALUES(id_tipo_produto), id_attribute = VALUES(id_attribute),
      id_option = VALUES(id_option), priority = VALUES(priority), active = 1`,
    [empresaId, input.term, normalized, input.type, input.canonical, input.productTypeId || null,
      input.attributeId || null, input.optionId || null, input.priority || 100, normalized.split(/\s+/).length]);
};

const run = async (): Promise<void> => {
  const empresaId = Number(process.argv[2] || process.env.SEARCH_SEED_EMPRESA_ID);
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error('Informe o tenant: npm run search:seed-dictionary -- <empresaId>');
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    for (const item of attributes) {
      await execute(connection, `INSERT INTO search_attribute_definitions
        (id_empresa, attribute_key, label, semantic_type, value_type, canonical_unit, hard_filterable, active)
        VALUES (?, ?, ?, ?, ?, ?, 1, 1)
        ON DUPLICATE KEY UPDATE label = VALUES(label), semantic_type = VALUES(semantic_type),
          value_type = VALUES(value_type), canonical_unit = VALUES(canonical_unit), active = 1`,
        [empresaId, item.key, item.label, item.semantic, item.valueType, item.unit || null]);
    }
    const attributeIds = new Map<string, number>();
    for (const item of attributes) attributeIds.set(item.key, await findId(connection, 'search_attribute_definitions', 'id_attribute', empresaId, 'attribute_key', item.key));
    const optionSeeds = [
      ['lined', 'yes', 'Com pauta', 'com pauta', 1], ['lined', 'no', 'Sem pauta', 'sem pauta', 0],
      ['double_wall', 'yes', 'Parede dupla', 'parede dupla', 1],
      ['material', 'stainless_steel', 'Aco inox', 'aco inox', null],
      ['contains_cups', 'two', 'Duas tacas', 'duas tacas', null],
      ['notebook_compatible', 'yes', 'Para notebook', 'notebook', 1],
      ['size_standard', 'a4', 'A4', 'a4', null], ['size_standard', 'a5', 'A5', 'a5', null],
      ['uv_printing', 'yes', 'Gravacao UV', 'uv', 1],
      ['material', 'polycarbonate', 'Policarbonato', 'pc', null],
    ] as const;
    const optionIds = new Map<string, number>();
    for (const [attributeKey, optionKey, label, canonical, booleanValue] of optionSeeds) {
      const attributeId = attributeIds.get(attributeKey)!;
      await execute(connection, `INSERT INTO search_attribute_options
        (id_empresa, id_attribute, option_key, label, canonical_value, boolean_value, active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE label = VALUES(label), canonical_value = VALUES(canonical_value), boolean_value = VALUES(boolean_value), active = 1`,
        [empresaId, attributeId, optionKey, label, canonical, booleanValue]);
      const [optionRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id_option FROM search_attribute_options WHERE id_empresa = ? AND id_attribute = ? AND option_key = ? LIMIT 1',
        [empresaId, attributeId, optionKey]
      );
      optionIds.set(`${attributeKey}:${optionKey}`, Number(optionRows[0].id_option));
    }
    const linedId = attributeIds.get('lined')!;
    const linedYes = optionIds.get('lined:yes')!;
    const linedNo = optionIds.get('lined:no')!;
    await execute(connection, `INSERT IGNORE INTO search_attribute_conflicts
      (id_empresa, id_attribute, id_option, conflicting_option_id) VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
      [empresaId, linedId, linedYes, linedNo, empresaId, linedId, linedNo, linedYes]);

    const typeAliases = [
      { term: 'bloco', match: 'bloco' }, { term: 'garrafa', match: 'garrafa' }, { term: 'mochila', match: 'mochila' },
    ];
    for (const alias of typeAliases) {
      const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT id_tipo_produto, tipo_produto FROM tipos_produtos WHERE id_empresa = ? AND LOWER(tipo_produto) LIKE ? ORDER BY id_tipo_produto LIMIT 1',
        [empresaId, `%${alias.match}%`]
      );
      if (rows[0]) await upsertDictionary(connection, empresaId, { term: alias.term, type: 'PRODUCT_TYPE', canonical: alias.term, productTypeId: Number(rows[0].id_tipo_produto), priority: 1000 });
    }
    const entries = [
      { term: 'com pauta', type: 'ATTRIBUTE', key: 'lined', option: 'yes' },
      { term: 'sem pauta', type: 'NEGATION', key: 'lined', option: 'no' },
      { term: 'parede dupla', type: 'ATTRIBUTE', key: 'double_wall', option: 'yes' },
      { term: 'aco inox', type: 'MATERIAL', key: 'material', option: 'stainless_steel' },
      { term: 'aço inox', type: 'MATERIAL', key: 'material', option: 'stainless_steel' },
      { term: 'inox', type: 'MATERIAL', key: 'material', option: 'stainless_steel' },
      { term: 'duas tacas', type: 'ATTRIBUTE', key: 'contains_cups', option: 'two' },
      { term: 'duas taças', type: 'ATTRIBUTE', key: 'contains_cups', option: 'two' },
      { term: 'notebook', type: 'ATTRIBUTE', key: 'notebook_compatible', option: 'yes' },
      { term: 'a4', type: 'ATTRIBUTE', key: 'size_standard', option: 'a4' },
      { term: 'a5', type: 'ATTRIBUTE', key: 'size_standard', option: 'a5' },
      { term: 'uv', type: 'ATTRIBUTE', key: 'uv_printing', option: 'yes' },
      { term: 'pc', type: 'MATERIAL', key: 'material', option: 'polycarbonate' },
    ];
    for (const entry of entries) await upsertDictionary(connection, empresaId, {
      term: entry.term, type: entry.type, canonical: entry.key,
      attributeId: attributeIds.get(entry.key), optionId: optionIds.get(`${entry.key}:${entry.option}`), priority: 900,
    });
    await upsertDictionary(connection, empresaId, { term: 'termica', type: 'SYNONYM', canonical: 'parede dupla', priority: 800 });
    await upsertDictionary(connection, empresaId, { term: 'térmica', type: 'SYNONYM', canonical: 'parede dupla', priority: 800 });
    for (const key of ['capacity_ml', 'screen_inches', 'weight_g', 'length_mm']) {
      await upsertDictionary(connection, empresaId, { term: key.replace('_', ' '), type: 'ATTRIBUTE', canonical: key, attributeId: attributeIds.get(key), priority: 1 });
    }
    await execute(connection, `INSERT INTO search_catalog_versions (id_empresa, catalog_version, dictionary_version)
      VALUES (?, 2, 2) ON DUPLICATE KEY UPDATE catalog_version = catalog_version + 1, dictionary_version = dictionary_version + 1`, [empresaId]);
    await connection.commit();
    console.log(JSON.stringify({ empresaId, attributes: attributes.length, dictionarySeeded: true }));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
};

run().catch((error) => { console.error('[search:seed-dictionary]', error); process.exitCode = 1; }).finally(() => closeDatabasePool());
