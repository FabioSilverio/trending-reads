import { useState, useEffect, useCallback } from 'react';
import type { Article, Category } from '../types/article';
import { fetchHackerNews } from '../services/hackerNewsService';
import { fetchReddit } from '../services/redditService';
import { fetchRssFeeds } from '../services/rssFeedService';
import { normalizeScores, deduplicateArticles, sortByScore, filterBySearch } from '../utils/articleNormalizer';
import { getCached, getStale, setCache, isCacheFresh } from '../utils/cache';

function cacheKey(category: Category) {
  return `trending-reads-${category}`;
}

export function useArticles(category: Category, searchQuery: string) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (cat: Category) => {
    const [hn, reddit, rss] = await Promise.allSettled([
      fetchHackerNews(cat),
      fetchReddit(cat),
      fetchRssFeeds(cat),
    ]);

    const all: Article[] = [
      ...(hn.status === 'fulfilled' ? hn.value : []),
      ...(reddit.status === 'fulfilled' ? reddit.value : []),
      ...(rss.status === 'fulfilled' ? rss.value : []),
    ];

    const deduplicated = deduplicateArticles(all);
    const normalized = normalizeScores(deduplicated);
    const sorted = sortByScore(normalized);

    return sorted;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);

      // Show stale data immediately
      const stale = getStale<Article[]>(cacheKey(category));
      if (stale && stale.length > 0) {
        setArticles(stale);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // If cache is fresh, don't refetch
      const fresh = getCached<Article[]>(cacheKey(category));
      if (fresh) {
        if (!cancelled) {
          setArticles(fresh);
          setLoading(false);
        }
        return;
      }

      // Fetch in background
      try {
        const data = await fetchAll(category);
        if (!cancelled) {
          setArticles(data);
          setCache(cacheKey(category), data);
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

  return { articles: filtered, loading, error, refresh, isCached: isCacheFresh(cacheKey(category)) };
}
