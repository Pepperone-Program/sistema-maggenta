import '../module-alias';
import assert from 'node:assert/strict';
import type { PoolConnection } from 'mysql2/promise';
import { migrations } from '@database/migrations';

const statements: string[] = [];
const connection = {
  execute: async (sql: string) => {
    statements.push(sql.replace(/\s+/g, ' ').trim());
    return [{ affectedRows: 0 }, []];
  },
} as unknown as PoolConnection;

const run = async (): Promise<void> => {
  for (const migration of migrations) await migration.up(connection);
  assert.equal(migrations.map((item) => item.id).join(','), '001-search-core,002-search-analytics');
  assert.equal(statements.some((sql) => sql.includes('FULLTEXT KEY ft_search_document_name')), true);
  assert.equal(statements.some((sql) => /ALTER\s+TABLE\s+produtos/i.test(sql)), false, 'a migration nao pode reconstruir produtos');
  assert.equal(statements.some((sql) => sql.includes('source ENUM(\'MANUAL\')')), true);
  assert.equal(statements.some((sql) => sql.includes('id_empresa, cor, id_produto')), true);

  statements.length = 0;
  for (const migration of [...migrations].reverse()) await migration.down(connection);
  assert.equal(statements.some((sql) => sql.includes('DROP TABLE IF EXISTS product_search_documents')), true);
  assert.equal(statements[statements.length - 1].includes('search_attribute_definitions'), true);
  console.log('searchMigrations.test: ok');
};

void run();
