import { useState, useEffect, useCallback, useRef } from 'react';
import type { Article, Category } from '../types/article';

// Base path for GitHub Pages
const BASE = import.meta.env.BASE_URL || '/trending-reads/';
const HN_API = 'https://hn.algolia.com/api/v1/search';

interface FeedsData {
  generatedAt: string;
  categories: Record<string, Article[]>;
}

// In-memory cache of the fetched feeds.json
let feedsCache: FeedsData | null = null;
let feedsFetchPromise: Promise<FeedsData | null> | null = null;

async function loadFeeds(): Promise<FeedsData | null> {
  if (feedsCache) return feedsCache;
  if (feedsFetchPromise) return feedsFetchPromise;

  feedsFetchPromise = (async () => {
    try {
      const url = `${BASE}data/feeds.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FeedsData = await res.json();
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

// ========== LIVE SEARCH via HN Algolia ==========

async function searchHN(query: string): Promise<Article[]> {
  try {
    const params = new URLSearchParams({
      query,
      tags: 'story',
      hitsPerPage: '30',
      numericFilters: 'points>5',
    });
    const res = await fetch(`${HN_API}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();

    return (data.hits || [])
      .filter((h: Record<string, unknown>) => h.title && (h.url || h.objectID))
      .map((h: Record<string, unknown>) => ({
        id: `hn-search-${h.objectID}`,
        title: h.title as string,
        url: (h.url as string) || `https://news.ycombinator.com/item?id=${h.objectID}`,
        source: 'Hacker News',
        category: 'tecnologia' as Category,
        score: ((h.points as number) || 0) + ((h.num_comments as number) || 0),
        description: '',
        publishedAt: h.created_at as string,
      }));
  } catch {
    return [];
  }
}

// ========== HOOK ==========

export function useArticles(category: Category | null, searchQuery: string) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const searchAbortRef = useRef(0);

  // Load articles from static feeds.json for the selected category
  const loadCategory = useCallback(async (cat: Category) => {
    const feeds = await loadFeeds();
    if (!feeds) throw new Error('Dados indisponíveis');
    setGeneratedAt(feeds.generatedAt);
    return feeds.categories[cat] || [];
  }, []);

  // Effect: load category data when category changes
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

    loadCategory(category)
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
  }, [category, loadCategory]);

  // Effect: live search when searchQuery changes
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || !category) return;

    // First filter from loaded articles
    const lower = query.toLowerCase();
    const localMatches = articles.filter(
      a => a.title.toLowerCase().includes(lower) ||
           a.source.toLowerCase().includes(lower) ||
           (a.description && a.description.toLowerCase().includes(lower))
    );

    // If we have enough local matches, don't hit the API
    if (localMatches.length >= 10) return;

    // Otherwise, also search HN Algolia for the query
    const searchId = ++searchAbortRef.current;

    const timer = setTimeout(async () => {
      try {
        const hnResults = await searchHN(query);
        if (searchAbortRef.current !== searchId) return; // stale

        // Merge HN results with local results, deduplicate
        const seen = new Set(localMatches.map(a => a.url));
        const newResults = hnResults.filter(a => !seen.has(a.url));
        if (newResults.length > 0) {
          setArticles(prev => {
            // Keep all original articles but append search results at the end
            const prevUrls = new Set(prev.map(a => a.url));
            const toAdd = newResults.filter(a => !prevUrls.has(a.url));
            return [...prev, ...toAdd];
          });
        }
      } catch { /* ignore */ }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, category]);

  // Filter displayed articles by search query
  const filtered = searchQuery.trim()
    ? articles.filter(a => {
        const lower = searchQuery.toLowerCase();
        return a.title.toLowerCase().includes(lower) ||
               a.source.toLowerCase().includes(lower) ||
               (a.description && a.description.toLowerCase().includes(lower));
      })
    : articles;

  // Refresh: force re-fetch feeds.json from server
  const refresh = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    setError(null);
    feedsCache = null;
    try {
      const data = await loadCategory(category);
      setArticles(data);
    } catch {
      setError('Falha ao carregar artigos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [category, loadCategory]);

  return { articles: filtered, loading, error, refresh, generatedAt };
}
