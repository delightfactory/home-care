interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

export class CacheManager {
  private static cache = new Map<string, CacheEntry>();
  private static pending = new Map<string, Promise<unknown>>();
  private static identity: string | null = null;
  private static profileIdentity: string | null = null;
  private static authorizationVersion = 0;
  static version = 0;
  static scopeVersion = 0;

  static setScope(identity: string | null): void {
    if (identity === this.identity) return;
    if (identity?.split(':', 1)[0] !== this.identity?.split(':', 1)[0]) this.authorizationVersion++;
    this.identity = identity;
    this.scopeVersion++;
    this.clear();
  }

  static setProfileScope(identity: string): void {
    if (identity === this.profileIdentity) return;
    this.profileIdentity = identity;
    this.authorizationVersion++;
    this.scopeVersion++;
    this.clear();
  }

  static set(key: string, data: unknown, ttl = 300000, version = this.version): void {
    if (version !== this.version) return;
    if (ttl <= 0 || data === null) {
      this.invalidate(key);
      return;
    }
    this.cache.set(key, { data, expiresAt: Date.now() + ttl });
  }

  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  static load<T>(key: string, loader: () => Promise<T>, ttl: number): Promise<T> {
    return this.loadForScope(key, loader, ttl, 1);
  }

  private static loadForScope<T>(key: string, loader: () => Promise<T>, ttl: number, refreshAttempts: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return Promise.resolve(cached);
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const version = this.version;
    const scopeVersion = this.scopeVersion;
    const authorizationVersion = this.authorizationVersion;
    const request = Promise.resolve().then(loader).then(response => {
      if (scopeVersion !== this.scopeVersion) {
        // Renew a token once without ever reusing data from the previous token.
        if (authorizationVersion === this.authorizationVersion && refreshAttempts > 0) {
          return this.loadForScope(key, loader, ttl, refreshAttempts - 1);
        }
        throw new Error('انتهت صلاحية نتيجة الجلسة السابقة');
      }
      this.set(key, response, ttl, version);
      return response;
    }).finally(() => {
      if (this.pending.get(key) === request) this.pending.delete(key);
    });
    this.pending.set(key, request);
    return request;
  }

  static invalidate(pattern: string): void {
    this.version++;
    for (const key of this.cache.keys()) if (key.includes(pattern)) this.cache.delete(key);
    for (const key of this.pending.keys()) if (key.includes(pattern)) this.pending.delete(key);
  }

  static cleanup(): void {
    for (const [key, entry] of this.cache) {
      if (Date.now() >= entry.expiresAt) this.cache.delete(key);
    }
  }

  static clear(): void {
    this.version++;
    this.cache.clear();
    this.pending.clear();
  }

  static getStats(): { size: number; keys: string[] } {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}
