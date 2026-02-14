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

// ========== PROXY STRATEGIES ==========

async function fetchViaCorsproxy(feedUrl: string): Promise<string> {
  const url = `https://corsproxy.io/?url=${encodeURIComponent(feedUrl)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`corsproxy.io failed: ${res.status}`);
  return res.text();
}

async function fetchViaCodetabs(feedUrl: string): Promise<string> {
  const url = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(feedUrl)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`codetabs failed: ${res.status}`);
  return res.text();
}

async function fetchViaRss2Json(feedUrl: string): Promise<FeedItem[]> {
  const params = new URLSearchParams({ rss_url: feedUrl });
  const res = await fetch(`https://api.rss2json.com/v1/api.json?${params}`);
  if (!res.ok) throw new Error(`rss2json failed: ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`rss2json status: ${data.status}`);
  return data.items.map((i: Record<string, string>) => ({
    title: i.title || '',
    link: i.link || '',
    description: i.description || '',
    pubDate: i.pubDate || '',
    thumbnail: i.thumbnail || '',
  }));
}

// ========== XML PARSING ==========

function parseXml(xml: string): FeedItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  // Handle RSS <item> and Atom <entry>
  let items = doc.querySelectorAll('item');
  if (items.length === 0) {
    items = doc.querySelectorAll('entry');
  }

  const results: FeedItem[] = [];

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent?.trim() || '';

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

    const thumbnail =
      item.querySelector('media\\:thumbnail')?.getAttribute('url') ||
      item.querySelector('media\\:content')?.getAttribute('url') ||
      '';

    if (title && link) {
      results.push({ title, link, description, pubDate, thumbnail });
    }
  });

  return results;
}

// ========== FETCH WITH FALLBACK CHAIN ==========

async function fetchFeed(feedUrl: string): Promise<FeedItem[]> {
  // Strategy 1: corsproxy.io → parse XML
  try {
    const xml = await fetchViaCorsproxy(feedUrl);
    const items = parseXml(xml);
    if (items.length > 0) return items;
  } catch {
    // fallthrough
  }

  // Strategy 2: codetabs → parse XML
  try {
    const xml = await fetchViaCodetabs(feedUrl);
    const items = parseXml(xml);
    if (items.length > 0) return items;
  } catch {
    // fallthrough
  }

  // Strategy 3: rss2json (already parsed, but rate limited)
  try {
    return await fetchViaRss2Json(feedUrl);
  } catch {
    // fallthrough
  }

  return [];
}

// ========== REDDIT URL EXTRACTION ==========

function extractRedditUrl(item: FeedItem): string {
  const match = item.description?.match(/href="(https?:\/\/(?!www\.reddit\.com)[^"]+)"/);
  if (match) return match[1];
  return item.link;
}

// ========== SCORING ==========

function computeScore(pubDate: string, index: number, descriptionLength: number): number {
  // Recency is king: articles from today get highest score
  let recencyScore = 0;
  if (pubDate) {
    const ageMs = Date.now() - new Date(pubDate).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 6) recencyScore = 80;
    else if (ageHours < 24) recencyScore = 65;
    else if (ageHours < 48) recencyScore = 50;
    else if (ageHours < 72) recencyScore = 40;
    else if (ageHours < 168) recencyScore = 25; // 1 week
    else recencyScore = 10;
  } else {
    recencyScore = Math.max(5, 30 - index * 3);
  }

  const lengthBonus = descriptionLength > 100 ? 8 : 0;
  const positionBonus = Math.max(0, 12 - index * 2); // first items in feed get a small boost

  return recencyScore + lengthBonus + positionBonus;
}

// ========== MAIN EXPORT ==========

export async function fetchRssFeeds(category: Category): Promise<Article[]> {
  const sources = RSS_SOURCES.filter((s) => s.category === category);
  const results: Article[] = [];

  // Fetch ALL feeds in parallel — no more rss2json rate limit concern
  const fetchPromises = sources.map(async (source) => {
    try {
      const items = await fetchFeed(source.url);
      const isReddit = source.name.startsWith('r/');

      return items
        .filter((item) => item.title && item.title.trim() !== '' && item.link && item.link.trim() !== '')
        .slice(0, 10)
        .map((item, index) => {
          const description = stripHtml(item.description).slice(0, 250);
          const url = isReddit ? extractRedditUrl(item) : item.link;

          return {
            id: `rss-${source.name}-${index}-${url}`,
            title: stripHtml(item.title),
            url,
            source: source.name,
            category,
            score: computeScore(item.pubDate, index, description.length),
            description,
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
            thumbnail: item.thumbnail || undefined,
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
