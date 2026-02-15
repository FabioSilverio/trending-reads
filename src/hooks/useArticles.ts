import { useState, useEffect, useCallback } from 'react';
import type { Article, Category } from '../types/article';
import { filterBySearch } from '../utils/articleNormalizer';

// Base path for GitHub Pages
const BASE = import.meta.env.BASE_URL || '/trending-reads/';

interface FeedsData {
  generatedAt: string;
  categories: Record<string, Article[]>;
}

// In-memory cache of the fetched feeds.json
let feedsCache: FeedsData | null = null;
let feedsFetchPromise: Promise<FeedsData | null> | null = null;

async function loadFeeds(): Promise<FeedsData | null> {
  // Return cached data if available
  if (feedsCache) return feedsCache;

  // Deduplicate in-flight requests
  if (feedsFetchPromise) return feedsFetchPromise;

  feedsFetchPromise = (async () => {
    try {
      const url = `${BASE}data/feeds.json`;
      console.log(`[useArticles] Fetching feeds from: ${url}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FeedsData = await res.json();
      console.log(`[useArticles] Feeds loaded, generated at: ${data.generatedAt}`);
      feedsCache = data;
      return data;
    } catch (e) {
      console.error('[useArticles] Failed to load feeds.json:', e);
      return null;
    } finally {
      feedsFetchPromise = null;
    }
  })();

  return feedsFetchPromise;
}

export function useArticles(category: Category | null, searchQuery: string) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const fetchCategory = useCallback(async (cat: Category) => {
    const feeds = await loadFeeds();
    if (!feeds) throw new Error('Dados indisponíveis');

    const categoryArticles = feeds.categories[cat] || [];
    setGeneratedAt(feeds.generatedAt);

    console.log(`[useArticles] ${cat}: ${categoryArticles.length} articles`);
    const sources = new Set(categoryArticles.map(a => a.source));
    console.log(`[useArticles] Sources: ${[...sources].join(', ')}`);

    return categoryArticles;
  }, []);

  useEffect(() => {
    if (!category) {
      setArticles([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCategory(category)
      .then(data => {
        if (!cancelled) {
          setArticles(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Falha ao carregar artigos. Tente novamente.');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [category, fetchCategory]);

  const filtered = filterBySearch(articles, searchQuery);

  const refresh = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    setError(null);
    // Force re-fetch by clearing cache
    feedsCache = null;
    try {
      const data = await fetchCategory(category);
      setArticles(data);
    } catch {
      setError('Falha ao carregar artigos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [category, fetchCategory]);

  return { articles: filtered, loading, error, refresh, generatedAt };
}
