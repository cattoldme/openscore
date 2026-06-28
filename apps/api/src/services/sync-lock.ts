import { randomUUID } from "node:crypto";
import type { RedisClientType } from "redis";

export type SyncLockProvider = "memory" | "redis";

export type SyncLockLease = {
  provider: SyncLockProvider;
  key: string;
  token: string;
  acquiredAt: string;
  expiresAt: string;
  release(): Promise<void>;
};

export type SyncLockSnapshot = {
  provider: SyncLockProvider;
  key: string;
  ttlMs: number;
  acquired: boolean;
  acquiredAt?: string;
  expiresAt?: string;
  updatedAt?: string;
};

export type SyncLock = {
  readonly provider: SyncLockProvider;
  acquire(key: string, ttlMs: number): Promise<SyncLockLease | null>;
};

type MemoryLockEntry = {
  token: string;
  expiresAt: number;
};

const RELEASE_SCRIPT =
  'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';

export class MemorySyncLock implements SyncLock {
  readonly provider = "memory";
  private readonly entries = new Map<string, MemoryLockEntry>();

  async acquire(key: string, ttlMs: number): Promise<SyncLockLease | null> {
    const now = Date.now();
    const existing = this.entries.get(key);

    if (existing && existing.expiresAt > now) {
      return null;
    }

    const token = randomUUID();
    const expiresAt = now + ttlMs;
    this.entries.set(key, {
      token,
      expiresAt
    });

    return {
      provider: this.provider,
      key,
      token,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      release: async () => {
        const current = this.entries.get(key);

        if (current?.token === token) {
          this.entries.delete(key);
        }
      }
    };
  }
}

export class RedisSyncLock implements SyncLock {
  readonly provider = "redis";
  private readonly prefix: string;

  constructor(
    private readonly client: RedisClientType,
    options: { prefix?: string } = {}
  ) {
    this.prefix = options.prefix ?? "openscore:lock:";
  }

  async acquire(key: string, ttlMs: number): Promise<SyncLockLease | null> {
    const token = randomUUID();
    const now = Date.now();
    const ttlSeconds = Math.max(Math.ceil(ttlMs / 1000), 1);
    const redisKey = this.toRedisKey(key);
    const result = await this.client.set(redisKey, token, {
      EX: ttlSeconds,
      NX: true
    });

    if (result !== "OK") {
      return null;
    }

    return {
      provider: this.provider,
      key,
      token,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
      release: async () => {
        await this.client.sendCommand(["EVAL", RELEASE_SCRIPT, "1", redisKey, token]);
      }
    };
  }

  private toRedisKey(key: string) {
    return `${this.prefix}${key}`;
  }
}
