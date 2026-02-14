import { useState, useEffect, useCallback } from 'react';
import type { Article, Category } from '../types/article';
import { fetchHackerNews } from '../services/hackerNewsService';
import { fetchRssFeeds } from '../services/rssFeedService';
import { normalizeScores, deduplicateArticles, sortByScore, filterBySearch, filterValid } from '../utils/articleNormalizer';
import { getCached, getStale, setCache, isCacheFresh } from '../utils/cache';

// Cache version — bump this to invalidate old caches
const CACHE_VERSION = 'v3';

function cacheKey(category: Category) {
  return `trending-reads-${CACHE_VERSION}-${category}`;
}

// Clear old cache entries on load
try {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('trending-reads-') && !key.includes(CACHE_VERSION)) {
      localStorage.removeItem(key);
    }
  }
} catch { /* ignore */ }

export function useArticles(category: Category | null, searchQuery: string) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (cat: Category) => {
    console.log(`[useArticles] Fetching category: ${cat}`);

    // HN and RSS run in parallel — RSS handles Reddit feeds too now
    const [hn, rss] = await Promise.allSettled([
      fetchHackerNews(cat),
      fetchRssFeeds(cat),
    ]);

    const hnArticles = hn.status === 'fulfilled' ? hn.value : [];
    const rssArticles = rss.status === 'fulfilled' ? rss.value : [];

    console.log(`[useArticles] HN: ${hnArticles.length} articles, RSS: ${rssArticles.length} articles`);
    if (hn.status === 'rejected') console.error('[useArticles] HN failed:', hn.reason);
    if (rss.status === 'rejected') console.error('[useArticles] RSS failed:', rss.reason);

    // Log unique sources
    const sources = new Set(rssArticles.map(a => a.source));
    console.log(`[useArticles] RSS sources:`, [...sources]);

    const all: Article[] = [...hnArticles, ...rssArticles];

    const valid = filterValid(all);
    const deduplicated = deduplicateArticles(valid);
    const normalized = normalizeScores(deduplicated);
    const sorted = sortByScore(normalized);

    console.log(`[useArticles] Final: ${sorted.length} articles (${valid.length} valid, ${deduplicated.length} unique)`);

    return sorted;
  }, []);

  useEffect(() => {
    if (!category) {
      setArticles([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setError(null);

      // Show stale data immediately
      const stale = getStale<Article[]>(cacheKey(category!));
      if (stale && stale.length > 0) {
        setArticles(stale);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // If cache is fresh, don't refetch
      const fresh = getCached<Article[]>(cacheKey(category!));
      if (fresh) {
        if (!cancelled) {
          setArticles(fresh);
          setLoading(false);
        }
        return;
      }

      // Fetch in background
      try {
        const data = await fetchAll(category!);
        if (!cancelled) {
          setArticles(data);
          setCache(cacheKey(category!), data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Falha ao carregar artigos. Tente novamente.');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [category, fetchAll]);

  const filtered = filterBySearch(articles, searchQuery);

  const refresh = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAll(category);
      setArticles(data);
      setCache(cacheKey(category), data);
    } catch {
      setError('Falha ao carregar artigos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [category, fetchAll]);

  return { articles: filtered, loading, error, refresh, isCached: category ? isCacheFresh(cacheKey(category)) : false };
}
