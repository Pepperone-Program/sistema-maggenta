import type { DatabaseMigration } from './types';
import { executeStatements } from './types';

const upStatements = [
  `CREATE TABLE IF NOT EXISTS search_attribute_definitions (
    id_attribute BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    attribute_key VARCHAR(80) NOT NULL,
    label VARCHAR(120) NOT NULL,
    semantic_type ENUM('ATTRIBUTE','MATERIAL','MEASUREMENT','SIZE','COMPOSITION') NOT NULL,
    value_type ENUM('BOOLEAN','ENUM','NUMBER','TEXT') NOT NULL,
    canonical_unit VARCHAR(20) NULL,
    hard_filterable TINYINT(1) NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_attribute),
    UNIQUE KEY uq_search_attribute_tenant_key (id_empresa, attribute_key),
    KEY idx_search_attribute_tenant_active (id_empresa, active, semantic_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS search_attribute_options (
    id_option BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    id_attribute BIGINT UNSIGNED NOT NULL,
    option_key VARCHAR(80) NOT NULL,
    label VARCHAR(120) NOT NULL,
    canonical_value VARCHAR(120) NOT NULL,
    boolean_value TINYINT(1) NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_option),
    UNIQUE KEY uq_search_option_tenant_attribute_key (id_empresa, id_attribute, option_key),
    KEY idx_search_option_tenant_active (id_empresa, active, id_attribute)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS search_attribute_conflicts (
    id_empresa INT NOT NULL,
    id_attribute BIGINT UNSIGNED NOT NULL,
    id_option BIGINT UNSIGNED NOT NULL,
    conflicting_option_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_empresa, id_option, conflicting_option_id),
    KEY idx_search_conflict_attribute (id_empresa, id_attribute, id_option)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS product_search_attributes (
    id_empresa INT NOT NULL,
    id_produto INT NOT NULL,
    id_attribute BIGINT UNSIGNED NOT NULL,
    id_option BIGINT UNSIGNED NULL,
    value_boolean TINYINT(1) NULL,
    value_number DECIMAL(18,4) NULL,
    value_text VARCHAR(255) NULL,
    unit VARCHAR(20) NULL,
    source ENUM('MANUAL') NOT NULL DEFAULT 'MANUAL',
    verified_by INT NOT NULL,
    verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_empresa, id_produto, id_attribute),
    KEY idx_product_search_attribute_option (id_empresa, id_attribute, id_option, id_produto),
    KEY idx_product_search_attribute_number (id_empresa, id_attribute, value_number, id_produto)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS product_search_contains_types (
    id_empresa INT NOT NULL,
    id_produto INT NOT NULL,
    id_tipo_produto INT NOT NULL,
    verified_by INT NOT NULL,
    verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_empresa, id_produto, id_tipo_produto),
    KEY idx_product_search_contains_reverse (id_empresa, id_tipo_produto, id_produto)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS search_dictionary (
    id_dictionary BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    term VARCHAR(200) NOT NULL,
    normalized_term VARCHAR(200) NOT NULL,
    term_type ENUM('PRODUCT_TYPE','ATTRIBUTE','MATERIAL','COLOR','SYNONYM','PHRASE','RELATED_TERM','NEGATION') NOT NULL,
    relation_type ENUM('EXACT_SYNONYM','RELATED_TERM','BROADER_TERM','NARROWER_TERM') NOT NULL DEFAULT 'EXACT_SYNONYM',
    canonical_value VARCHAR(200) NOT NULL,
    id_tipo_produto INT NULL,
    id_attribute BIGINT UNSIGNED NULL,
    id_option BIGINT UNSIGNED NULL,
    priority INT NOT NULL DEFAULT 0,
    confidence DECIMAL(4,3) NOT NULL DEFAULT 1.000,
    token_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_dictionary),
    UNIQUE KEY uq_search_dictionary_mapping (id_empresa, normalized_term, term_type, canonical_value),
    KEY idx_search_dictionary_lookup (id_empresa, active, normalized_term, priority)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS product_search_documents (
    id_empresa INT NOT NULL,
    id_produto INT NOT NULL,
    id_tipo_produto INT NULL,
    original_name VARCHAR(200) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    search_text TEXT NOT NULL,
    site CHAR(1) NOT NULL,
    habilitado CHAR(1) NOT NULL,
    popularity_score DECIMAL(18,4) NOT NULL DEFAULT 0,
    document_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_empresa, id_produto),
    KEY idx_search_document_scope (id_empresa, site, habilitado, id_tipo_produto, id_produto),
    KEY idx_search_document_prefix (id_empresa, normalized_name, id_produto),
    FULLTEXT KEY ft_search_document_name (normalized_name),
    FULLTEXT KEY ft_search_document_text (search_text)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS product_search_popularity (
    id_empresa INT NOT NULL,
    id_produto INT NOT NULL,
    popularity_score DECIMAL(18,4) NOT NULL DEFAULT 0,
    calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_empresa, id_produto),
    KEY idx_search_popularity_rank (id_empresa, popularity_score, id_produto)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS search_catalog_versions (
    id_empresa INT NOT NULL,
    catalog_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    dictionary_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_empresa)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE INDEX IF NOT EXISTS idx_aux_produtos_cores_search ON aux_produtos_cores (id_empresa, cor, id_produto)`,
  `INSERT IGNORE INTO aux_grupos_permissoes (id_empresa, grupo, permissao)
   SELECT DISTINCT id_empresa, grupo, 'search.manage' FROM aux_grupos_permissoes WHERE grupo = 'admin'`,
  `INSERT IGNORE INTO aux_grupos_permissoes (id_empresa, grupo, permissao)
   SELECT DISTINCT id_empresa, grupo, 'search.debug' FROM aux_grupos_permissoes WHERE grupo = 'admin'`,
];

const downStatements = [
  `DELETE FROM aux_grupos_permissoes WHERE grupo = 'admin' AND permissao IN ('search.manage','search.debug')`,
  `DROP INDEX IF EXISTS idx_aux_produtos_cores_search ON aux_produtos_cores`,
  `DROP TABLE IF EXISTS search_catalog_versions`,
  `DROP TABLE IF EXISTS product_search_popularity`,
  `DROP TABLE IF EXISTS product_search_documents`,
  `DROP TABLE IF EXISTS search_dictionary`,
  `DROP TABLE IF EXISTS product_search_contains_types`,
  `DROP TABLE IF EXISTS product_search_attributes`,
  `DROP TABLE IF EXISTS search_attribute_conflicts`,
  `DROP TABLE IF EXISTS search_attribute_options`,
  `DROP TABLE IF EXISTS search_attribute_definitions`,
];

export const searchCoreMigration: DatabaseMigration = {
  id: '001-search-core',
  description: 'Estruturas de catalogacao manual, documentos e dicionario de busca',
  up: (connection) => executeStatements(connection, upStatements),
  down: (connection) => executeStatements(connection, downStatements),
};
