import type { Article } from '../types/article';

export function normalizeScores(articles: Article[]): Article[] {
  if (articles.length === 0) return [];

  const maxScore = Math.max(...articles.map((a) => a.score), 1);
  return articles.map((a) => ({
    ...a,
    score: Math.round((a.score / maxScore) * 100),
  }));
}

export function deduplicateArticles(articles: Article[]): Article[] {
  const seen = new Map<string, Article>();

  for (const article of articles) {
    const key = normalizeUrl(article.url);
    const existing = seen.get(key);
    if (!existing || article.score > existing.score) {
      seen.set(key, article);
    }
  }

  return Array.from(seen.values());
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '') + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function sortByScore(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => b.score - a.score);
}

export function filterBySearch(articles: Article[], query: string): Article[] {
  if (!query.trim()) return articles;
  const lower = query.toLowerCase();
  return articles.filter(
    (a) =>
      a.title.toLowerCase().includes(lower) ||
      a.source.toLowerCase().includes(lower) ||
      (a.description && a.description.toLowerCase().includes(lower))
  );
}
