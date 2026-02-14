import type { Article, Category } from '../types/article';
import { RSS_SOURCES } from '../config/feedSources';

interface Rss2JsonItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  thumbnail?: string;
  enclosure?: { link?: string };
}

interface Rss2JsonResponse {
  status: string;
  items: Rss2JsonItem[];
  feed: { title: string };
}

const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json';
const ALLORIGINS_API = 'https://api.allorigins.win/raw?url=';

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

async function fetchViaRss2Json(feedUrl: string): Promise<Rss2JsonItem[]> {
  // Don't use &count param — it requires a paid API key now
  const params = new URLSearchParams({ rss_url: feedUrl });
  const res = await fetch(`${RSS2JSON_API}?${params}`);
  if (!res.ok) throw new Error(`rss2json failed: ${res.status}`);
  const data: Rss2JsonResponse = await res.json();
  if (data.status !== 'ok') throw new Error('rss2json status not ok');
  return data.items;
}

async function fetchViaAllOrigins(feedUrl: string): Promise<Rss2JsonItem[]> {
  const res = await fetch(`${ALLORIGINS_API}${encodeURIComponent(feedUrl)}`);
  if (!res.ok) throw new Error(`allorigins failed: ${res.status}`);
  const xml = await res.text();
  return parseXml(xml);
}

function parseXml(xml: string): Rss2JsonItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  // Handle both RSS <item> and Atom <entry>
  let items = doc.querySelectorAll('item');
  if (items.length === 0) {
    items = doc.querySelectorAll('entry');
  }

  const results: Rss2JsonItem[] = [];

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent || '';
    // For Atom feeds, link might be an attribute
    let link = item.querySelector('link')?.textContent || '';
    if (!link) {
      link = item.querySelector('link')?.getAttribute('href') || '';
    }
    const description = item.querySelector('description')?.textContent
      || item.querySelector('summary')?.textContent
      || item.querySelector('content')?.textContent
      || '';
    const pubDate = item.querySelector('pubDate')?.textContent
      || item.querySelector('published')?.textContent
      || item.querySelector('updated')?.textContent
      || '';

    if (title && link) {
      results.push({ title, link, description, pubDate });
    }
  });

  return results;
}

export async function fetchRssFeeds(category: Category): Promise<Article[]> {
  const sources = RSS_SOURCES.filter((s) => s.category === category);
  const results: Article[] = [];

  // Fetch all sources in parallel for speed
  const fetchPromises = sources.map(async (source) => {
    try {
      let items: Rss2JsonItem[];
      try {
        items = await fetchViaRss2Json(source.url);
      } catch {
        items = await fetchViaAllOrigins(source.url);
      }

      const now = Date.now();
      return items
        .filter((item) => item.title && item.title.trim() !== '' && item.link && item.link.trim() !== '')
        .slice(0, 15)
        .map((item, index) => {
          const description = stripHtml(item.description).slice(0, 250);
          const recencyScore = Math.max(0, 50 - index * 3);
          const lengthBonus = description.length > 100 ? 10 : 0;

          return {
            id: `rss-${source.name}-${index}-${item.link}`,
            title: item.title,
            url: item.link,
            source: source.name,
            category,
            score: recencyScore + lengthBonus,
            description,
            publishedAt: item.pubDate
              ? new Date(item.pubDate).toISOString()
              : new Date(now - index * 3600000).toISOString(),
            thumbnail: item.thumbnail || item.enclosure?.link,
          };
        });
    } catch {
      console.warn(`[RSS] Failed to fetch: ${source.name}`);
      return [];
    }
  });

  const allResults = await Promise.all(fetchPromises);
  for (const batch of allResults) {
    results.push(...batch);
  }

  return results;
}
