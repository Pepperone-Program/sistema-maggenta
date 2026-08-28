import type { DatabaseMigration } from './types';
import { executeStatements } from './types';

const upStatements = [
  `CREATE TABLE IF NOT EXISTS search_events (
    search_id CHAR(36) NOT NULL,
    id_empresa INT NOT NULL,
    query_original VARCHAR(200) NOT NULL,
    query_normalized VARCHAR(200) NOT NULL,
    parsed_intent LONGTEXT NOT NULL,
    results_count INT NOT NULL,
    related_results_count INT NOT NULL DEFAULT 0,
    candidate_count INT NOT NULL,
    latency_ms INT NOT NULL,
    parse_time_ms INT NOT NULL,
    database_time_ms INT NOT NULL,
    ranking_time_ms INT NOT NULL,
    ranking_version VARCHAR(30) NOT NULL,
    search_mode ENUM('legacy','shadow','advanced') NOT NULL,
    zero_results TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (search_id),
    KEY idx_search_events_tenant_created (id_empresa, created_at),
    KEY idx_search_events_tenant_query (id_empresa, query_normalized, created_at),
    KEY idx_search_events_zero (id_empresa, zero_results, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS search_click_events (
    id_click BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    search_id CHAR(36) NOT NULL,
    id_produto INT NOT NULL,
    position INT NOT NULL,
    score DECIMAL(18,4) NULL,
    clicked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_click),
    KEY idx_search_click_tenant_search (id_empresa, search_id, clicked_at),
    KEY idx_search_click_product (id_empresa, id_produto, clicked_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS search_conversion_events (
    id_conversion BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    search_id CHAR(36) NOT NULL,
    id_orcamento INT NOT NULL,
    id_produto INT NOT NULL DEFAULT 0,
    converted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_conversion),
    UNIQUE KEY uq_search_conversion (id_empresa, search_id, id_orcamento, id_produto),
    KEY idx_search_conversion_tenant_date (id_empresa, converted_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const downStatements = [
  `DROP TABLE IF EXISTS search_conversion_events`,
  `DROP TABLE IF EXISTS search_click_events`,
  `DROP TABLE IF EXISTS search_events`,
];

export const searchAnalyticsMigration: DatabaseMigration = {
  id: '002-search-analytics',
  description: 'Eventos de busca, clique e conversao',
  up: (connection) => executeStatements(connection, upStatements),
  down: (connection) => executeStatements(connection, downStatements),
};
