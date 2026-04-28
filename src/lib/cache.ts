/**
 * Simple request caching utility
 * Reduces redundant API calls and improves performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<any>>();

export function setCacheEntry<T>(key: string, data: T, ttlMs: number = 5000): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  });
}

export function getCacheEntry<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

export function clearCache(keyPattern?: string): void {
  if (!keyPattern) {
    cache.clear();
  } else {
    const regex = new RegExp(keyPattern);
    for (const key of cache.keys()) {
      if (regex.test(key)) {
        cache.delete(key);
      }
    }
  }
}

export function invalidateCache(key: string): void {
  cache.delete(key);
}

export async function cachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = 5000
): Promise<T> {
  // Check cache first
  const cached = getCacheEntry<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch and cache
  const data = await fetchFn();
  setCacheEntry(key, data, ttlMs);
  return data;
}
