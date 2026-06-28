export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class TtlCache {
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

  clear(prefix?: string): void {
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

  snapshot() {
    const now = Date.now();

    return {
      size: this.entries.size,
      keys: Array.from(this.entries.entries()).map(([key, entry]) => ({
        key,
        expiresInMs: Math.max(entry.expiresAt - now, 0)
      }))
    };
  }
}
