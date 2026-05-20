import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

type DbErrorCode =
  | 'ER_ACCESS_DENIED_ERROR'
  | 'ER_DBACCESS_DENIED_ERROR'
  | 'ER_BAD_DB_ERROR'
  | 'ER_CON_COUNT_ERROR'
  | 'ER_USER_LIMIT_REACHED'
  | 'ECONNREFUSED'
  | 'ECONNRESET'
  | 'EPIPE'
  | 'PROTOCOL_CONNECTION_LOST'
  | 'POOL_ENQUEUELIMIT'
  | 'ETIMEDOUT'
  | 'UNKNOWN';

declare global {
  var pepperoneMysqlPool: mysql.Pool | undefined;
}

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const connectionLimit = toPositiveInt(process.env.DB_CONNECTION_LIMIT, 5);
const maxIdle = Math.min(toPositiveInt(process.env.DB_MAX_IDLE, connectionLimit), connectionLimit);
const readRetryAttempts = toPositiveInt(process.env.DB_READ_RETRY_ATTEMPTS, 2);
const readRetryDelayMs = toPositiveInt(process.env.DB_READ_RETRY_DELAY_MS, 150);

const config: mysql.PoolOptions = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit,
  maxIdle,
  idleTimeout: toPositiveInt(process.env.DB_IDLE_TIMEOUT_MS, 60000),
  queueLimit: toPositiveInt(process.env.DB_QUEUE_LIMIT, 100),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: toPositiveInt(process.env.DB_CONNECT_TIMEOUT_MS, 10000),
};

const validateConfig = (): void => {
  const missing: string[] = [];

  if (!config.host) missing.push('DB_HOST');
  if (!config.user) missing.push('DB_USER');
  if (!config.password) missing.push('DB_PASSWORD');
  if (!config.database) missing.push('DB_NAME');

  if (missing.length > 0) {
    const error = new Error(
      `Variáveis de ambiente ausentes: ${missing.join(', ')}`
    ) as Error & { code: string; statusCode: number };
    error.code = 'DB_CONFIG_ERROR';
    error.statusCode = 500;
    throw error;
  }
};

validateConfig();

const createDatabasePool = (): mysql.Pool => {
  if (!globalThis.pepperoneMysqlPool) {
    globalThis.pepperoneMysqlPool = mysql.createPool(config);
  }

  return globalThis.pepperoneMysqlPool;
};

const pool = createDatabasePool();

const mapDbError = (error: unknown): Error & { code: string; statusCode: number } => {
  const dbError = error as { code?: DbErrorCode; message?: string };

  const mapped = new Error('Falha na conexão com o banco de dados') as Error & {
    code: string;
    statusCode: number;
  };

  switch (dbError.code) {
    case 'ER_DBACCESS_DENIED_ERROR':
      mapped.code = 'DB_ACCESS_DENIED';
      mapped.statusCode = 503;
      mapped.message =
        'Usuário sem permissão para o schema configurado. Verifique DB_NAME e GRANTs.';
      break;
    case 'ER_ACCESS_DENIED_ERROR':
      mapped.code = 'DB_AUTH_DENIED';
      mapped.statusCode = 503;
      mapped.message =
        'Autenticação no MySQL falhou. Verifique DB_USER e DB_PASSWORD.';
      break;
    case 'ER_BAD_DB_ERROR':
      mapped.code = 'DB_NOT_FOUND';
      mapped.statusCode = 503;
      mapped.message = 'Schema configurado não existe no servidor MySQL.';
      break;
    case 'ER_CON_COUNT_ERROR':
    case 'ER_USER_LIMIT_REACHED':
    case 'POOL_ENQUEUELIMIT':
      mapped.code = 'DB_TOO_MANY_REQUESTS';
      mapped.statusCode = 503;
      mapped.message =
        'Banco de dados atingiu o limite de conexoes simultaneas. Tente novamente em instantes.';
      break;
    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'EPIPE':
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ETIMEDOUT':
      mapped.code = 'DB_UNREACHABLE';
      mapped.statusCode = 503;
      mapped.message = 'Servidor MySQL indisponível ou inacessível.';
      break;
    default:
      mapped.code = 'DB_QUERY_ERROR';
      mapped.statusCode = 500;
      mapped.message = dbError.message || 'Erro interno ao consultar banco de dados.';
      break;
  }

  return mapped;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isReadOnlySql = (sql: string): boolean =>
  /^(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i.test(sql.trim());

const isRetryableDbError = (error: Error & { code: string }): boolean =>
  error.code === 'DB_TOO_MANY_REQUESTS' || error.code === 'DB_UNREACHABLE';

export const getConnection = async () => {
  for (let attempt = 0; attempt <= readRetryAttempts; attempt += 1) {
    try {
      return await pool.getConnection();
    } catch (error) {
      const mapped = mapDbError(error);
      if (attempt >= readRetryAttempts || !isRetryableDbError(mapped)) {
        throw mapped;
      }
      await sleep(readRetryDelayMs * (attempt + 1));
    }
  }

  throw mapDbError(new Error('Falha ao obter conexão com o banco de dados'));
};

export const query = async (sql: string, values?: any[]): Promise<any> => {
  const retryableRead = isReadOnlySql(sql);

  for (let attempt = 0; attempt <= (retryableRead ? readRetryAttempts : 0); attempt += 1) {
    try {
      const [result] = await pool.execute(sql, values);
      return result;
    } catch (error) {
      const mapped = mapDbError(error);
      if (!retryableRead || attempt >= readRetryAttempts || !isRetryableDbError(mapped)) {
        throw mapped;
      }
      await sleep(readRetryDelayMs * (attempt + 1));
    }
  }

  throw mapDbError(new Error('Falha ao consultar banco de dados'));
};

export const testDatabaseConnection = async (): Promise<void> => {
  const connection = await getConnection();
  try {
    await connection.execute('SELECT 1');
  } finally {
    connection.release();
  }
};

export const closeDatabasePool = async (): Promise<void> => {
  if (!globalThis.pepperoneMysqlPool) return;
  await globalThis.pepperoneMysqlPool.end();
  globalThis.pepperoneMysqlPool = undefined;
};

export default pool;
