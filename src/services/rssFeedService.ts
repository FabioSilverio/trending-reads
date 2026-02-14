import type { Article, Category } from '../types/article';
import { RSS_SOURCES, RSS_FETCH_DELAY_MS } from '../config/feedSources';

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

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchViaRss2Json(feedUrl: string): Promise<Rss2JsonItem[]> {
  const params = new URLSearchParams({ rss_url: feedUrl });
  const res = await fetch(`${RSS2JSON_API}?${params}`);
  if (!res.ok) throw new Error(`rss2json failed: ${res.status}`);
  const data: Rss2JsonResponse = await res.json();
  if (data.status !== 'ok') throw new Error(`rss2json status: ${data.status}`);
  return data.items;
}

async function fetchViaAllOrigins(feedUrl: string): Promise<Rss2JsonItem[]> {
  // Use allorigins /get endpoint which wraps in JSON (more reliable than /raw)
  const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`);
  if (!res.ok) throw new Error(`allorigins failed: ${res.status}`);
  const json = await res.json();
  const xml = json.contents;
  if (!xml || typeof xml !== 'string') throw new Error('allorigins empty response');
  return parseXml(xml);
}

function parseXml(xml: string): Rss2JsonItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  // Handle RSS <item> and Atom <entry>
  let items = doc.querySelectorAll('item');
  if (items.length === 0) {
    items = doc.querySelectorAll('entry');
  }

  const results: Rss2JsonItem[] = [];

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent?.trim() || '';

    // Links: RSS uses <link> text, Atom uses <link href="">
    let link = item.querySelector('link')?.textContent?.trim() || '';
    if (!link) {
      link = item.querySelector('link')?.getAttribute('href')?.trim() || '';
    }

    const description =
      item.querySelector('description')?.textContent ||
      item.querySelector('summary')?.textContent ||
      item.querySelector('content')?.textContent ||
      '';

    const pubDate =
      item.querySelector('pubDate')?.textContent ||
      item.querySelector('published')?.textContent ||
      item.querySelector('updated')?.textContent ||
      '';

    if (title && link) {
      results.push({ title, link, description, pubDate });
    }
  });

  return results;
}

/**
 * Extract the actual article URL from Reddit RSS items.
 * Reddit RSS items have a link to the reddit discussion,
 * but the actual external URL is often in the description HTML.
 */
function extractRedditUrl(item: Rss2JsonItem): string {
  // Try to find external URL in the description HTML
  const match = item.description?.match(/href="(https?:\/\/(?!www\.reddit\.com)[^"]+)"/);
  if (match) return match[1];
  // Fallback to the reddit link itself
  return item.link;
}

export async function fetchRssFeeds(category: Category): Promise<Article[]> {
  const sources = RSS_SOURCES.filter((s) => s.category === category);
  const results: Article[] = [];

  // Fetch feeds sequentially with delay to avoid rss2json rate limit
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];

    // Add delay between requests (not before the first one)
    if (i > 0) {
      await delay(RSS_FETCH_DELAY_MS);
    }

    try {
      let items: Rss2JsonItem[];
      try {
        items = await fetchViaRss2Json(source.url);
      } catch {
        // Fallback to allorigins if rss2json fails
        try {
          items = await fetchViaAllOrigins(source.url);
        } catch {
          console.warn(`[RSS] Both proxies failed for: ${source.name}`);
          continue;
        }
      }

      const isReddit = source.name.startsWith('r/');
      const now = Date.now();

      const articles = items
        .filter((item) => item.title && item.title.trim() !== '' && item.link && item.link.trim() !== '')
        .slice(0, 10)
        .map((item, index) => {
          const description = stripHtml(item.description).slice(0, 250);
          const recencyScore = Math.max(0, 50 - index * 3);
          const lengthBonus = description.length > 100 ? 10 : 0;
          const url = isReddit ? extractRedditUrl(item) : item.link;

          return {
            id: `rss-${source.name}-${index}-${url}`,
            title: stripHtml(item.title),
            url,
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
