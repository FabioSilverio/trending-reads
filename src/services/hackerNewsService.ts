import type { Article, Category } from '../types/article';
import { HN_SEARCH_TERMS } from '../config/feedSources';

const HN_API = 'https://hn.algolia.com/api/v1/search';

interface HNHit {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  num_comments: number;
  created_at: string;
  story_text?: string;
}

interface HNResponse {
  hits: HNHit[];
}

export async function fetchHackerNews(category: Category): Promise<Article[]> {
  const terms = HN_SEARCH_TERMS[category];
  const query = terms.slice(0, 3).join(' OR ');

  const params = new URLSearchParams({
    query,
    tags: 'story',
    hitsPerPage: '20',
    numericFilters: 'points>10',
  });

  try {
    const res = await fetch(`${HN_API}?${params}`);
    if (!res.ok) return [];
    const data: HNResponse = await res.json();

    return data.hits
      .filter((hit) => hit.url)
      .map((hit) => ({
        id: `hn-${hit.objectID}`,
        title: hit.title,
        url: hit.url!,
        source: 'Hacker News',
        category,
        score: hit.points + hit.num_comments * 2,
        description: hit.story_text?.slice(0, 200),
        publishedAt: hit.created_at,
      }));
  } catch {
    console.warn(`[HN] Failed to fetch for category: ${category}`);
    return [];
  }
}
