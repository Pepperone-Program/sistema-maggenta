type RedisCommandResponse<T = unknown> = {
  result?: T;
  error?: string;
};

const CACHE_PREFIX = 'site-mag';
const inFlight = new Map<string, Promise<unknown>>();
const productRelatedNamespaces = new Set([
  'categorias',
  'subcategorias',
  'tipos-produtos',
  'datas-promocionais',
  'publicos-alvos',
]);
const productContentNamespaces = [
  'produtos',
  'categorias',
  'subcategorias',
  'tipos-produtos',
  'publicos-alvos',
  'datas-promocionais',
] as const;
const knownNamespaces = [
  ...productContentNamespaces,
  'banners',
  'landing-pages',
] as const;

const getRedisConfig = (): { url?: string; token?: string } => ({
  url: process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, ''),
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const isEnabled = (): boolean => {
  const { url, token } = getRedisConfig();
  return Boolean(url && token);
};

const normalizePart = (value: string): string =>
  value
    .trim()
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9:_?&=.,/-]/g, '_');

export class CacheService {
  static readonly productContentNamespaces = productContentNamespaces;

  static readonly knownNamespaces = knownNamespaces;

  static buildKey(namespace: string, rawKey: string): string {
    return `${CACHE_PREFIX}:${normalizePart(namespace)}:${normalizePart(rawKey)}`;
  }

  static async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    if (!isEnabled()) {
      return loader();
    }

    const cached = await this.get<T>(key);
    if (cached.found) {
      return cached.value as T;
    }

    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  static async getOrSetCoalesced<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds: number,
    lockTtlMs = 1500
  ): Promise<{ value: T; status: 'hit' | 'miss' | 'coalesced' }> {
    if (isEnabled()) {
      const cached = await this.get<T>(key);
      if (cached.found) return { value: cached.value as T, status: 'hit' };
    }

    const existing = inFlight.get(key) as Promise<T> | undefined;
    if (existing) return { value: await existing, status: 'coalesced' };

    const pending = (async () => {
      let distributedLockToken: string | null = null;
      try {
        if (isEnabled()) {
          distributedLockToken = await this.acquireLock(`${key}:lock`, lockTtlMs);
          if (!distributedLockToken) {
            for (let attempt = 0; attempt < 8; attempt += 1) {
              await new Promise((resolve) => setTimeout(resolve, 50));
              const retried = await this.get<T>(key);
              if (retried.found) return retried.value as T;
            }
          }
        }
        const value = await loader();
        if (isEnabled()) await this.set(key, value, ttlSeconds);
        return value;
      } finally {
        if (distributedLockToken) await this.releaseLock(`${key}:lock`, distributedLockToken);
      }
    })();
    inFlight.set(key, pending);
    try {
      return { value: await pending, status: 'miss' };
    } finally {
      if (inFlight.get(key) === pending) inFlight.delete(key);
    }
  }

  static async invalidateNamespace(namespace: string): Promise<void> {
    if (!isEnabled()) return;

    await this.invalidateNamespaceOnly(namespace);

    if (productRelatedNamespaces.has(namespace)) {
      await this.invalidateNamespaceOnly('produtos');
    }
  }

  static async invalidateNamespaces(namespaces: readonly string[]): Promise<void> {
    if (!isEnabled()) return;

    const expandedNamespaces = new Set<string>();

    for (const namespace of namespaces) {
      expandedNamespaces.add(namespace);
      if (productRelatedNamespaces.has(namespace)) {
        expandedNamespaces.add('produtos');
      }
    }

    await Promise.all(
      Array.from(expandedNamespaces).map((namespace) =>
        this.invalidateNamespaceOnly(namespace)
      )
    );
  }

  private static async invalidateNamespaceOnly(namespace: string): Promise<void> {
    if (!isEnabled()) return;

    const pattern = `${CACHE_PREFIX}:${normalizePart(namespace)}:*`;

    try {
      const keys: string[] = [];
      let cursor = '0';

      do {
        const response = await this.command<[string, string[]]>([
          'SCAN',
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          '100',
        ]);
        const result = response.result;
        cursor = result?.[0] || '0';
        keys.push(...(result?.[1] || []));
      } while (cursor !== '0');

      if (keys.length === 0) return;
      await this.command<number>(['DEL', ...keys]);
    } catch (error) {
      console.warn('[CacheService] invalidate failed', {
        namespace,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private static async get<T>(key: string): Promise<{ found: boolean; value?: T }> {
    try {
      const response = await this.command<string | null>(['GET', key]);
      if (!response.result) {
        return { found: false };
      }

      return { found: true, value: JSON.parse(response.result) as T };
    } catch (error) {
      console.warn('[CacheService] get failed', {
        key,
        message: error instanceof Error ? error.message : String(error),
      });
      return { found: false };
    }
  }

  private static async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const command = ttlSeconds
        ? ['SET', key, JSON.stringify(value), 'EX', String(ttlSeconds)]
        : ['SET', key, JSON.stringify(value)];
      await this.command<string>(command);
    } catch (error) {
      console.warn('[CacheService] set failed', {
        key,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private static async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    try {
      const token = crypto.randomUUID();
      const response = await this.command<string | null>(['SET', key, token, 'NX', 'PX', String(ttlMs)]);
      return response.result === 'OK' ? token : null;
    } catch (error) {
      console.warn('[CacheService] lock failed; degrading to database', {
        message: error instanceof Error ? error.message : String(error),
      });
      return crypto.randomUUID();
    }
  }

  private static async releaseLock(key: string, token: string): Promise<void> {
    try {
      await this.command<number>([
        'EVAL',
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        '1',
        key,
        token,
      ]);
    } catch {
      // The lock has a short TTL; failure to release must not fail a search.
    }
  }

  private static async command<T>(command: string[]): Promise<RedisCommandResponse<T>> {
    const { url, token } = getRedisConfig();
    if (!url || !token) {
      return {};
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(`Upstash responded with ${response.status}`);
    }

    const body = (await response.json()) as RedisCommandResponse<T>;
    if (body.error) {
      throw new Error(body.error);
    }

    return body;
  }
}
import crypto from 'crypto';
