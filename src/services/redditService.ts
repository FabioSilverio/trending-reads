import type { Article, Category } from '../types/article';
import { REDDIT_SOURCES } from '../config/feedSources';

interface RedditPost {
  data: {
    id: string;
    title: string;
    url: string;
    score: number;
    num_comments: number;
    created_utc: number;
    selftext?: string;
    is_self: boolean;
    subreddit: string;
  };
}

interface RedditResponse {
  data: {
    children: RedditPost[];
  };
}

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

export async function fetchReddit(category: Category): Promise<Article[]> {
  const sources = REDDIT_SOURCES.filter((s) => s.category === category);
  const results: Article[] = [];

  const fetchPromises = sources.map(async (source) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      // Use CORS proxy since Reddit blocks browser-side requests
      const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(source.url)}`;
      const res = await fetch(proxiedUrl, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return [];
      const data: RedditResponse = await res.json();

      if (!data?.data?.children) return [];

      return data.data.children
        .filter((post) => {
          const d = post.data;
          return !d.is_self && d.url && d.title && d.title.trim() !== '';
        })
        .map((post) => ({
          id: `reddit-${post.data.id}`,
          title: post.data.title,
          url: post.data.url,
          source: source.name,
          category,
          score: post.data.score,
          description: post.data.selftext?.slice(0, 200) || undefined,
          publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
        }));
    } catch {
      console.warn(`[Reddit] Failed to fetch: ${source.name}`);
      return [];
    }
  });

  const allResults = await Promise.all(fetchPromises);
  for (const batch of allResults) {
    results.push(...batch);
  }

  return results;
}
