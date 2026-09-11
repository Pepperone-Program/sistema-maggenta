import '../module-alias';
import { closeDatabasePool } from '@database/connection';
import { SearchCoverageRepairService } from '@search/SearchCoverageRepairService';

const run = async (): Promise<void> => {
  const empresaId = Number(process.argv[2] || process.env.SEARCH_REBUILD_EMPRESA_ID);
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new Error('Informe o tenant: npm run search:repair-coverage -- <empresaId>');
  }

  console.log(JSON.stringify(await SearchCoverageRepairService.repair(empresaId)));
};

run()
  .catch((error) => {
    console.error('[search:repair-coverage]', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => closeDatabasePool());
