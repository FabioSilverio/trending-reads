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
  const params = new URLSearchParams({ rss_url: feedUrl, count: '15' });
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
  const items = doc.querySelectorAll('item');
  const results: Rss2JsonItem[] = [];

  items.forEach((item) => {
    results.push({
      title: item.querySelector('title')?.textContent || '',
      link: item.querySelector('link')?.textContent || '',
      description: item.querySelector('description')?.textContent || '',
      pubDate: item.querySelector('pubDate')?.textContent || '',
    });
  });

  return results;
}

export async function fetchRssFeeds(category: Category): Promise<Article[]> {
  const sources = RSS_SOURCES.filter((s) => s.category === category);
  const results: Article[] = [];

  for (const source of sources) {
    try {
      let items: Rss2JsonItem[];
      try {
        items = await fetchViaRss2Json(source.url);
      } catch {
        items = await fetchViaAllOrigins(source.url);
      }

      const now = Date.now();
      const articles = items.map((item, index) => {
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

      results.push(...articles);
    } catch {
      console.warn(`[RSS] Failed to fetch: ${source.name}`);
    }
  }

  return results;
}
