import type { PoolConnection } from 'mysql2/promise';

export interface DatabaseMigration {
  id: string;
  description: string;
  up(connection: PoolConnection): Promise<void>;
  down(connection: PoolConnection): Promise<void>;
}

export const executeStatements = async (
  connection: PoolConnection,
  statements: string[]
): Promise<void> => {
  for (const statement of statements) {
    await connection.execute(statement);
  }
};
