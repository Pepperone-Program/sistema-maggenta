import { getConnection } from '@database/connection';
import { migrations } from '@database/migrations';
import type { DatabaseMigration } from '@database/migrations/types';

const ensureMigrationTable = async (): Promise<void> => {
  const connection = await getConnection();
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(100) NOT NULL,
        description VARCHAR(255) NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } finally {
    connection.release();
  }
};

const appliedMigrationIds = async (): Promise<Set<string>> => {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute('SELECT id FROM schema_migrations ORDER BY id ASC');
    return new Set((rows as Array<{ id: string }>).map((row) => row.id));
  } finally {
    connection.release();
  }
};

const applyMigration = async (migration: DatabaseMigration): Promise<void> => {
  const connection = await getConnection();
  try {
    const lockWaitTimeout = Math.min(Math.max(Number(process.env.DB_MIGRATION_LOCK_WAIT_TIMEOUT || 30), 1), 300);
    await connection.query(`SET SESSION lock_wait_timeout = ${Math.trunc(lockWaitTimeout)}`);
    await migration.up(connection);
    await connection.execute(
      'INSERT INTO schema_migrations (id, description) VALUES (?, ?)',
      [migration.id, migration.description]
    );
  } finally {
    connection.release();
  }
};

const rollbackMigration = async (migration: DatabaseMigration): Promise<void> => {
  const connection = await getConnection();
  try {
    const lockWaitTimeout = Math.min(Math.max(Number(process.env.DB_MIGRATION_LOCK_WAIT_TIMEOUT || 30), 1), 300);
    await connection.query(`SET SESSION lock_wait_timeout = ${Math.trunc(lockWaitTimeout)}`);
    await migration.down(connection);
    await connection.execute('DELETE FROM schema_migrations WHERE id = ?', [migration.id]);
  } finally {
    connection.release();
  }
};

export class MigrationRunner {
  static async up(): Promise<string[]> {
    const lockConnection = await getConnection();
    try {
      const [lockRows] = await lockConnection.query("SELECT GET_LOCK('maggenta_schema_migrations', 30) AS acquired");
      if (Number((lockRows as Array<{ acquired: number }>)[0]?.acquired) !== 1) throw new Error('Nao foi possivel adquirir o lock de migrations');
      await ensureMigrationTable();
      const applied = await appliedMigrationIds();
      const executed: string[] = [];
      for (const migration of migrations) {
        if (applied.has(migration.id)) continue;
        await applyMigration(migration);
        executed.push(migration.id);
      }
      return executed;
    } finally {
      await lockConnection.query("SELECT RELEASE_LOCK('maggenta_schema_migrations')").catch(() => undefined);
      lockConnection.release();
    }
  }

  static async down(): Promise<string[]> {
    const lockConnection = await getConnection();
    try {
      const [lockRows] = await lockConnection.query("SELECT GET_LOCK('maggenta_schema_migrations', 30) AS acquired");
      if (Number((lockRows as Array<{ acquired: number }>)[0]?.acquired) !== 1) throw new Error('Nao foi possivel adquirir o lock de migrations');
      await ensureMigrationTable();
      const applied = await appliedMigrationIds();
      const migration = [...migrations].reverse().find((item) => applied.has(item.id));
      if (!migration) return [];
      await rollbackMigration(migration);
      return [migration.id];
    } finally {
      await lockConnection.query("SELECT RELEASE_LOCK('maggenta_schema_migrations')").catch(() => undefined);
      lockConnection.release();
    }
  }
}
