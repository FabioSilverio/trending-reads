import type { Article, Category } from '../types/article';
import { HN_SEARCH_TERMS } from '../config/feedSources';

const HN_API = 'https://hn.algolia.com/api/v1/search_by_date';

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
    numericFilters: 'points>10',
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

function computeHNScore(hit: HNHit): number {
  // Combine engagement with recency
  const engagement = hit.points + hit.num_comments * 2;

  const ageMs = Date.now() - new Date(hit.created_at).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  let recencyMultiplier = 1;
  if (ageHours < 6) recencyMultiplier = 3;
  else if (ageHours < 24) recencyMultiplier = 2.5;
  else if (ageHours < 48) recencyMultiplier = 2;
  else if (ageHours < 72) recencyMultiplier = 1.5;
  else if (ageHours < 168) recencyMultiplier = 1;
  else recencyMultiplier = 0.5;

  return engagement * recencyMultiplier;
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
      score: computeHNScore(hit),
      description: hit.story_text?.slice(0, 200),
      publishedAt: hit.created_at,
    }));
}
