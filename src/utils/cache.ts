import type { CacheEntry } from '../types/article';
import { CACHE_TTL_MS } from '../config/feedSources';

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
    return null;
  } catch {
    return null;
  }
}

export function getStale<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function isCacheFresh(key: string): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
  } catch {
    return false;
  }
}
