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

export async function fetchReddit(category: Category): Promise<Article[]> {
  const sources = REDDIT_SOURCES.filter((s) => s.category === category);
  const results: Article[] = [];

  for (const source of sources) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(source.url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const data: RedditResponse = await res.json();

      const articles = data.data.children
        .filter((post) => !post.data.is_self && post.data.url)
        .map((post) => ({
          id: `reddit-${post.data.id}`,
          title: post.data.title,
          url: post.data.url,
          source: source.name,
          category,
          score: post.data.score,
          description: post.data.selftext?.slice(0, 200),
          publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
        }));

      results.push(...articles);
    } catch {
      console.warn(`[Reddit] Failed to fetch: ${source.name}`);
    }
  }

  return results;
}
