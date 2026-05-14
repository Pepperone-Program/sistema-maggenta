type RedisCommandResponse<T = unknown> = {
  result?: T;
  error?: string;
};

const CACHE_PREFIX = 'site-pep';

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

  static async invalidateNamespace(namespace: string): Promise<void> {
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
