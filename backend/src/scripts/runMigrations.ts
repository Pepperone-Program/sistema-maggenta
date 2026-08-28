import '../module-alias';
import { closeDatabasePool } from '@database/connection';
import { MigrationRunner } from '@database/MigrationRunner';

const direction = process.argv[2];

const run = async (): Promise<void> => {
  if (direction !== 'up' && direction !== 'down') {
    throw new Error('Use: npm run db:migrate ou npm run db:rollback');
  }
  const executed = direction === 'up' ? await MigrationRunner.up() : await MigrationRunner.down();
  console.log(JSON.stringify({ direction, executed }, null, 2));
};

run().then(
  () => closeDatabasePool(),
  async (error) => {
    console.error('migration: falha', error);
    await closeDatabasePool().catch(() => undefined);
    process.exitCode = 1;
  }
);
