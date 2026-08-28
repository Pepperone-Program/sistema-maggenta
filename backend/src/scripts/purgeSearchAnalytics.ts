import '../module-alias';
import { closeDatabasePool } from '@database/connection';
import { SearchAnalyticsService } from '@search/SearchAnalyticsService';

SearchAnalyticsService.purge(Number(process.argv[2] || 180))
  .then(() => console.log('Retencao de analytics aplicada'))
  .catch((error) => { console.error('[search:purge-analytics]', error); process.exitCode = 1; })
  .finally(() => closeDatabasePool());
