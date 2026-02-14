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

async function fetchViaCodetabs(feedUrl: string): Promise<string> {
  const url = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(feedUrl)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`codetabs ${res.status}`);
  const text = await res.text();
  // Validate it's actually XML, not an error page
  if (!text.includes('<') || text.startsWith('<!DOCTYPE html')) {
    throw new Error('codetabs returned HTML instead of XML');
  }
  return text;
}

async function fetchViaRss2Json(feedUrl: string): Promise<FeedItem[]> {
  const params = new URLSearchParams({ rss_url: feedUrl });
  const res = await fetch(`https://api.rss2json.com/v1/api.json?${params}`);
  if (!res.ok) throw new Error(`rss2json ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`rss2json: ${data.message || data.status}`);
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

  // Check for parse errors
  if (doc.querySelector('parsererror')) {
    return [];
  }

  // Handle RSS <item> and Atom <entry>
  let items = doc.querySelectorAll('item');
  if (items.length === 0) {
    items = doc.querySelectorAll('entry');
  }

  const results: FeedItem[] = [];

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent?.trim() || '';

    // RSS: <link>text</link>, Atom: <link href="..."/>
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
  // Strategy 1: codetabs (works for 20/22 feeds, CORS ok, no rate limit)
  try {
    const xml = await fetchViaCodetabs(feedUrl);
    const items = parseXml(xml);
    if (items.length > 0) return items;
  } catch {
    // fallthrough
  }

  // Strategy 2: rss2json (rate limited but works as fallback)
  try {
    const items = await fetchViaRss2Json(feedUrl);
    if (items.length > 0) return items;
  } catch {
    // fallthrough
  }

  return [];
}

// ========== REDDIT URL EXTRACTION ==========

function extractRedditUrl(item: FeedItem): string {
  // Reddit RSS description contains the external link
  const match = item.description?.match(/href="(https?:\/\/(?!www\.reddit\.com)[^"]+)"/);
  if (match) return match[1];
  return item.link;
}

// ========== SCORING ==========

function computeScore(pubDate: string, index: number, descriptionLength: number): number {
  let recencyScore = 0;
  if (pubDate) {
    const ageMs = Date.now() - new Date(pubDate).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 6) recencyScore = 80;
    else if (ageHours < 24) recencyScore = 65;
    else if (ageHours < 48) recencyScore = 50;
    else if (ageHours < 72) recencyScore = 40;
    else if (ageHours < 168) recencyScore = 25;
    else recencyScore = 10;
  } else {
    recencyScore = Math.max(5, 30 - index * 3);
  }

  const lengthBonus = descriptionLength > 100 ? 8 : 0;
  const positionBonus = Math.max(0, 12 - index * 2);

  return recencyScore + lengthBonus + positionBonus;
}

// ========== MAIN EXPORT ==========

export async function fetchRssFeeds(category: Category): Promise<Article[]> {
  const sources = RSS_SOURCES.filter((s) => s.category === category);
  const results: Article[] = [];

  // Fetch ALL feeds in parallel — codetabs has no rate limit
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
