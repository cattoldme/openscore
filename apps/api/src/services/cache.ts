import { createClient, type RedisClientType } from "redis";

export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type CacheSnapshot = {
  provider: "memory" | "redis";
  size: number;
  keys: Array<{
    key: string;
    expiresInMs: number;
  }>;
};

export type CacheStore = {
  getOrSet<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T>;
  clear(prefix?: string): Promise<void>;
  snapshot(): Promise<CacheSnapshot>;
};

export class TtlCache implements CacheStore {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  async getOrSet<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.entries.get(key);

    if (cached && cached.expiresAt > now) {
      return cached.value as T;
    }

    const value = await load();
    this.entries.set(key, {
      value,
      expiresAt: now + ttlMs
    });

    return value;
  }

  async clear(prefix?: string): Promise<void> {
    if (!prefix) {
      this.entries.clear();
      return;
    }

    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }

  async snapshot(): Promise<CacheSnapshot> {
    const now = Date.now();

    return {
      provider: "memory",
      size: this.entries.size,
      keys: Array.from(this.entries.entries()).map(([key, entry]) => ({
        key,
        expiresInMs: Math.max(entry.expiresAt - now, 0)
      }))
    };
  }
}

export class RedisCache implements CacheStore {
  private readonly prefix: string;

  constructor(
    private readonly client: RedisClientType,
    options: { prefix?: string } = {}
  ) {
    this.prefix = options.prefix ?? "openscore:cache:";
  }

  async getOrSet<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const redisKey = this.toRedisKey(key);
    const cached = await this.client.get(redisKey);

    if (cached) {
      return JSON.parse(cached) as T;
    }

    const value = await load();
    await this.client.set(redisKey, JSON.stringify(value), {
      EX: Math.max(Math.ceil(ttlMs / 1000), 1)
    });

    return value;
  }

  async clear(prefix?: string): Promise<void> {
    const pattern = prefix ? `${this.toRedisKey(prefix)}*` : `${this.prefix}*`;
    const keys: string[] = [];

    for await (const chunk of this.client.scanIterator({
      MATCH: pattern,
      COUNT: 100
    })) {
      keys.push(...toKeyList(chunk));
    }

    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }

  async snapshot(): Promise<CacheSnapshot> {
    const keys: string[] = [];

    for await (const chunk of this.client.scanIterator({
      MATCH: `${this.prefix}*`,
      COUNT: 100
    })) {
      keys.push(...toKeyList(chunk));
    }

    const rows = await Promise.all(
      keys.map(async (key) => {
        const ttlMs = await this.client.pTTL(key);

        return {
          key: key.slice(this.prefix.length),
          expiresInMs: ttlMs > 0 ? ttlMs : 0
        };
      })
    );

    return {
      provider: "redis",
      size: rows.length,
      keys: rows
    };
  }

  private toRedisKey(key: string) {
    return `${this.prefix}${key}`;
  }
}

function toKeyList(chunk: string | string[]): string[] {
  return Array.isArray(chunk) ? chunk : [chunk];
}

export async function createRedisCache(redisUrl: string): Promise<RedisCache> {
  const client = createClient({
    url: redisUrl
  });

  client.on("error", (error) => {
    console.error("Redis cache error", error);
  });

  await client.connect();
  return new RedisCache(client as RedisClientType);
}
