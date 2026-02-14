import type { Article, Category } from '../types/article';
import { RSS_SOURCES } from '../config/feedSources';

interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  thumbnail?: string;
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// ========== CORS PROXY STRATEGIES ==========

// Strategy 1: codetabs proxy
async function fetchViaCodetabs(feedUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(feedUrl)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`codetabs HTTP ${res.status}`);
    const text = await res.text();
    // Validate it's XML, not an error page
    if (!text || text.length < 50 || text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      throw new Error('codetabs returned HTML instead of XML');
    }
    return text;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// Strategy 2: rss2json API (returns JSON, not XML)
async function fetchViaRss2Json(feedUrl: string): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const params = new URLSearchParams({ rss_url: feedUrl });
    const res = await fetch(
      `https://api.rss2json.com/v1/api.json?${params}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`rss2json HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message || data.status);
    return (data.items || []).map((i: Record<string, string>) => ({
      title: i.title || '',
      link: i.link || '',
      description: i.description || '',
      pubDate: i.pubDate || '',
      thumbnail: i.thumbnail || '',
    }));
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ========== XML PARSER ==========

function parseXml(xml: string): FeedItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return [];

  let nodes = doc.querySelectorAll('item');
  if (nodes.length === 0) nodes = doc.querySelectorAll('entry');

  const results: FeedItem[] = [];
  nodes.forEach((node) => {
    const title = node.querySelector('title')?.textContent?.trim() || '';
    let link = node.querySelector('link')?.textContent?.trim() || '';
    if (!link) link = node.querySelector('link')?.getAttribute('href')?.trim() || '';
    const desc =
      node.querySelector('description')?.textContent ||
      node.querySelector('summary')?.textContent || '';
    const pubDate =
      node.querySelector('pubDate')?.textContent ||
      node.querySelector('published')?.textContent ||
      node.querySelector('updated')?.textContent || '';

    // Extract thumbnail from media:content, media:thumbnail, or enclosure
    let thumbnail = '';
    const mediaContent = node.querySelector('content[url], thumbnail[url]');
    if (mediaContent) {
      thumbnail = mediaContent.getAttribute('url') || '';
    }
    const enclosure = node.querySelector('enclosure[url]');
    if (!thumbnail && enclosure) {
      const type = enclosure.getAttribute('type') || '';
      if (type.startsWith('image/')) {
        thumbnail = enclosure.getAttribute('url') || '';
      }
    }

    if (title && link) results.push({ title, link, description: desc, pubDate, thumbnail });
  });
  return results;
}

// ========== FETCH ONE FEED (with multi-proxy fallback) ==========

async function fetchOneFeed(feedUrl: string, sourceName: string): Promise<FeedItem[]> {
  const errors: string[] = [];

  // Try codetabs first (returns raw XML, CORS: *)
  try {
    const xml = await fetchViaCodetabs(feedUrl);
    const items = parseXml(xml);
    if (items.length > 0) {
      console.log(`[RSS] ${sourceName}: ${items.length} items via codetabs`);
      return items;
    }
    errors.push('codetabs: 0 items parsed');
  } catch (e) {
    errors.push(`codetabs: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Fallback: rss2json (returns JSON, no XML parsing needed)
  try {
    const items = await fetchViaRss2Json(feedUrl);
    if (items.length > 0) {
      console.log(`[RSS] ${sourceName}: ${items.length} items via rss2json`);
      return items;
    }
    errors.push('rss2json: 0 items');
  } catch (e) {
    errors.push(`rss2json: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.warn(`[RSS] ${sourceName}: ALL proxies failed`, errors);
  return [];
}

// ========== HELPERS ==========

function extractRedditUrl(item: FeedItem): string {
  const match = item.description?.match(
    /href="(https?:\/\/(?!www\.reddit\.com)[^"]+)"/
  );
  return match ? match[1] : item.link;
}

function computeScore(pubDate: string, index: number, descLen: number): number {
  let recency = 0;
  if (pubDate) {
    const h = (Date.now() - new Date(pubDate).getTime()) / 3600000;
    if (h < 6) recency = 80;
    else if (h < 24) recency = 65;
    else if (h < 48) recency = 50;
    else if (h < 72) recency = 40;
    else if (h < 168) recency = 25;
    else recency = 10;
  } else {
    recency = Math.max(5, 30 - index * 3);
  }
  return recency + (descLen > 100 ? 8 : 0) + Math.max(0, 12 - index * 2);
}

// ========== MAIN ==========

export async function fetchRssFeeds(category: Category): Promise<Article[]> {
  const sources = RSS_SOURCES.filter((s) => s.category === category);
  const allArticles: Article[] = [];

  console.log(`[RSS] Fetching ${sources.length} feeds for category: ${category}`);

  // Fetch all feeds concurrently (each feed has its own timeout/fallback)
  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const items = await fetchOneFeed(source.url, source.name);
        const isReddit = source.name.startsWith('r/');

        return items
          .filter((it) => it.title?.trim() && it.link?.trim())
          .slice(0, 10)
          .map((it, idx) => {
            const desc = stripHtml(it.description).slice(0, 250);
            const url = isReddit ? extractRedditUrl(it) : it.link;
            return {
              id: `rss-${source.name}-${idx}-${url}`,
              title: stripHtml(it.title),
              url,
              source: source.name,
              category,
              score: computeScore(it.pubDate, idx, desc.length),
              description: desc,
              publishedAt: it.pubDate
                ? new Date(it.pubDate).toISOString()
                : undefined,
              thumbnail: it.thumbnail || undefined,
            };
          });
      } catch (e) {
        console.error(`[RSS] ${source.name}: unexpected error`, e);
        return [];
      }
    })
  );

  for (const batch of results) allArticles.push(...batch);

  console.log(`[RSS] Total articles for ${category}: ${allArticles.length}`);
  return allArticles;
}
