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

async function searchHN(query: string): Promise<HNHit[]> {
  const params = new URLSearchParams({
    query,
    tags: 'story',
    hitsPerPage: '15',
    numericFilters: 'points>20',
  });

  try {
    const res = await fetch(`${HN_API}?${params}`);
    if (!res.ok) return [];
    const data: HNResponse = await res.json();
    return data.hits;
  } catch {
    return [];
  }
}

export async function fetchHackerNews(category: Category): Promise<Article[]> {
  const terms = HN_SEARCH_TERMS[category];

  // Fetch each term separately because Algolia doesn't support OR in query string
  const allHits = await Promise.all(terms.map((term) => searchHN(term)));
  const flatHits = allHits.flat();

  // Deduplicate by objectID
  const seen = new Set<string>();
  const uniqueHits: HNHit[] = [];
  for (const hit of flatHits) {
    if (!seen.has(hit.objectID)) {
      seen.add(hit.objectID);
      uniqueHits.push(hit);
    }
  }

  return uniqueHits
    .filter((hit) => hit.title && hit.title.trim() !== '')
    .map((hit) => ({
      id: `hn-${hit.objectID}`,
      title: hit.title,
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      source: 'Hacker News',
      category,
      score: hit.points + hit.num_comments * 2,
      description: hit.story_text?.slice(0, 200),
      publishedAt: hit.created_at,
    }));
}
