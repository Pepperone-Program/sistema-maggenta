import type { DatabaseMigration } from './types';
import { searchCoreMigration } from './001-search-core';
import { searchAnalyticsMigration } from './002-search-analytics';

export const migrations: DatabaseMigration[] = [searchCoreMigration, searchAnalyticsMigration];
