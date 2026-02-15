/**
 * Server-side feed fetcher — runs in GitHub Actions (Node.js, no CORS)
 * Fetches all RSS feeds + HackerNews and writes data/feeds.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Max articles PER feed source — keeps results diverse
const MAX_PER_FEED = 5;
const MAX_HN_PER_TERM = 8;

// ========== CONFIG ==========

const CATEGORIES = ['filosofia', 'entretenimento', 'tecnologia', 'ciencia'];

const HN_SEARCH_TERMS = {
  filosofia: ['philosophy', 'ethics', 'stoicism', 'existentialism'],
  entretenimento: ['film essay', 'book review', 'culture', 'music essay'],
  tecnologia: ['programming', 'software engineering', 'AI', 'open source'],
  ciencia: ['science', 'physics', 'neuroscience', 'biology'],
};

const RSS_SOURCES = [
  // ===== FILOSOFIA (10 feeds) =====
  { name: 'Aeon', url: 'https://aeon.co/feed.rss', category: 'filosofia' },
  { name: 'The Marginalian', url: 'https://www.themarginalian.org/feed/', category: 'filosofia' },
  { name: 'Daily Nous', url: 'https://dailynous.com/feed/', category: 'filosofia' },
  { name: 'Stanford Encyclopedia', url: 'https://plato.stanford.edu/rss/sep.xml', category: 'filosofia' },
  { name: 'r/philosophy', url: 'https://www.reddit.com/r/philosophy/top/.rss?t=week', category: 'filosofia' },
  { name: 'Psyche', url: 'https://psyche.co/feed', category: 'filosofia' },
  { name: 'r/existentialism', url: 'https://www.reddit.com/r/Existentialism/top/.rss?t=week', category: 'filosofia' },
  { name: 'r/askphilosophy', url: 'https://www.reddit.com/r/askphilosophy/top/.rss?t=week', category: 'filosofia' },
  { name: 'r/stoicism', url: 'https://www.reddit.com/r/Stoicism/top/.rss?t=week', category: 'filosofia' },
  { name: 'Blog of the APA', url: 'https://blog.apaonline.org/feed/', category: 'filosofia' },

  // ===== ENTRETENIMENTO (8 feeds) =====
  { name: 'Longreads', url: 'https://longreads.com/feed/', category: 'entretenimento' },
  { name: 'The Guardian - Culture', url: 'https://www.theguardian.com/culture/rss', category: 'entretenimento' },
  { name: 'Open Culture', url: 'https://www.openculture.com/feed', category: 'entretenimento' },
  { name: 'The New Yorker', url: 'https://www.newyorker.com/feed/culture', category: 'entretenimento' },
  { name: 'r/TrueFilm', url: 'https://www.reddit.com/r/TrueFilm/top/.rss?t=week', category: 'entretenimento' },
  { name: 'r/books', url: 'https://www.reddit.com/r/books/top/.rss?t=week', category: 'entretenimento' },
  { name: 'The Guardian - Books', url: 'https://www.theguardian.com/books/rss', category: 'entretenimento' },
  { name: 'Literary Hub', url: 'https://lithub.com/feed/', category: 'entretenimento' },

  // ===== TECNOLOGIA (8 feeds) =====
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tecnologia' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'tecnologia' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', category: 'tecnologia' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tecnologia' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'tecnologia' },
  { name: 'r/programming', url: 'https://www.reddit.com/r/programming/top/.rss?t=week', category: 'tecnologia' },
  { name: 'The Register', url: 'https://www.theregister.com/headlines.atom', category: 'tecnologia' },
  { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/feeds/feed.rss', category: 'tecnologia' },

  // ===== CIÊNCIA (8 feeds) =====
  { name: 'Quanta Magazine', url: 'https://api.quantamagazine.org/feed/', category: 'ciencia' },
  { name: 'Nature', url: 'https://www.nature.com/nature.rss', category: 'ciencia' },
  { name: 'Science Daily', url: 'https://www.sciencedaily.com/rss/all.xml', category: 'ciencia' },
  { name: 'Phys.org', url: 'https://phys.org/rss-feed/', category: 'ciencia' },
  { name: 'New Scientist', url: 'https://www.newscientist.com/feed/home/', category: 'ciencia' },
  { name: 'r/science', url: 'https://www.reddit.com/r/science/top/.rss?t=week', category: 'ciencia' },
  { name: 'The Conversation - Science', url: 'https://theconversation.com/us/technology/articles.atom', category: 'ciencia' },
  { name: 'Live Science', url: 'https://www.livescience.com/feeds/all', category: 'ciencia' },
];

// ========== XML PARSING (simple regex-based, no DOM in Node) ==========

function extractTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))</${tagName}>`, 'i');
  const match = xml.match(regex);
  if (match) return (match[1] || match[2] || '').trim();
  return '';
}

function extractAttr(xml, tagName, attrName) {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#039;/g, "'")
    .replace(/&#8217;/g, '\u2019').replace(/&#8216;/g, '\u2018')
    .replace(/&#8220;/g, '\u201C').replace(/&#8221;/g, '\u201D')
    .replace(/&#8211;/g, '\u2013').replace(/&#8212;/g, '\u2014')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '')
    .trim();
}

function parseRssXml(xml) {
  const items = [];
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    let link = extractTag(block, 'link');
    if (!link) link = extractAttr(block, 'link', 'href');
    const description = extractTag(block, 'description') || extractTag(block, 'summary') || '';
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated') || '';

    if (title && link) {
      items.push({ title: stripHtml(title), link, description, pubDate });
    }
  }

  return items;
}

// ========== FETCH HELPERS ==========

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TrendingReads/1.0 (GitHub Actions feed aggregator)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

function extractRedditUrl(description) {
  const match = description.match(/href="(https?:\/\/(?!www\.reddit\.com)[^"]+)"/);
  return match ? match[1] : null;
}

function computeScore(pubDate, index, descLen) {
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

// ========== FETCH RSS ==========

async function fetchOneFeed(source) {
  try {
    const xml = await fetchWithTimeout(source.url);
    if (!xml || xml.length < 50) {
      console.log(`  [SKIP] ${source.name}: empty response`);
      return [];
    }
    if (xml.includes('<!DOCTYPE html') || (xml.startsWith('<html') && !xml.includes('<rss') && !xml.includes('<feed'))) {
      console.log(`  [SKIP] ${source.name}: got HTML instead of RSS`);
      return [];
    }

    const items = parseRssXml(xml);
    console.log(`  [OK] ${source.name}: ${items.length} items`);

    const isReddit = source.name.startsWith('r/');

    return items.slice(0, MAX_PER_FEED).map((item, idx) => {
      const desc = stripHtml(item.description).slice(0, 250);
      let url = item.link;
      if (isReddit) {
        const extracted = extractRedditUrl(item.description);
        if (extracted) url = extracted;
      }

      return {
        id: `rss-${source.name}-${idx}`,
        title: item.title,
        url,
        source: source.name,
        category: source.category,
        score: computeScore(item.pubDate, idx, desc.length),
        description: desc,
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
      };
    });
  } catch (e) {
    console.log(`  [FAIL] ${source.name}: ${e.message}`);
    return [];
  }
}

// ========== FETCH HACKER NEWS ==========

async function fetchHackerNews(category) {
  const terms = HN_SEARCH_TERMS[category];
  const allArticles = [];

  for (const term of terms) {
    try {
      const params = new URLSearchParams({
        query: term,
        tags: 'story',
        hitsPerPage: String(MAX_HN_PER_TERM),
        numericFilters: 'points>10',
      });
      const res = await fetch(`https://hn.algolia.com/api/v1/search_by_date?${params}`);
      if (!res.ok) continue;
      const data = await res.json();

      for (const hit of data.hits) {
        if (!hit.title?.trim()) continue;

        const ageMs = Date.now() - new Date(hit.created_at).getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        let recencyMultiplier = 1;
        if (ageHours < 6) recencyMultiplier = 3;
        else if (ageHours < 24) recencyMultiplier = 2.5;
        else if (ageHours < 48) recencyMultiplier = 2;
        else if (ageHours < 72) recencyMultiplier = 1.5;
        else if (ageHours < 168) recencyMultiplier = 1;
        else recencyMultiplier = 0.5;

        const engagement = hit.points + (hit.num_comments || 0) * 2;

        allArticles.push({
          id: `hn-${hit.objectID}`,
          title: hit.title,
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          source: 'Hacker News',
          category,
          score: engagement * recencyMultiplier,
          description: hit.story_text?.slice(0, 200) || '',
          publishedAt: hit.created_at,
        });
      }
    } catch (e) {
      console.log(`  [HN FAIL] term="${term}": ${e.message}`);
    }
  }

  // Deduplicate
  const seen = new Set();
  return allArticles.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

// ========== NORMALIZE ==========

function normalizeScores(articles) {
  if (articles.length === 0) return [];

  const hn = articles.filter(a => a.source === 'Hacker News');
  const rss = articles.filter(a => a.source !== 'Hacker News');

  function normalizeGroup(group) {
    if (group.length === 0) return [];
    const maxScore = Math.max(...group.map(a => a.score));
    if (maxScore === 0) return group.map(a => ({ ...a, score: 50 }));
    return group.map(a => ({
      ...a,
      score: Math.round((a.score / maxScore) * 100),
    }));
  }

  return [...normalizeGroup(hn), ...normalizeGroup(rss)];
}

function deduplicateArticles(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterValid(articles) {
  return articles.filter(a => {
    if (!a.title || a.title.trim().length < 5) return false;
    if (!a.url || !a.url.startsWith('http')) return false;
    return true;
  });
}

// ========== MAIN ==========

async function main() {
  console.log('=== Trending Reads Feed Fetcher ===\n');

  const result = {};

  for (const category of CATEGORIES) {
    console.log(`\n\u{1F4C2} Category: ${category}`);

    const sources = RSS_SOURCES.filter(s => s.category === category);
    console.log(`  Fetching ${sources.length} RSS feeds...`);

    const rssResults = await Promise.all(sources.map(s => fetchOneFeed(s)));
    const rssArticles = rssResults.flat();
    console.log(`  RSS total: ${rssArticles.length} articles`);

    console.log(`  Fetching HackerNews...`);
    const hnArticles = await fetchHackerNews(category);
    console.log(`  HN total: ${hnArticles.length} articles`);

    const all = [...hnArticles, ...rssArticles];
    const valid = filterValid(all);
    const deduped = deduplicateArticles(valid);
    const normalized = normalizeScores(deduped);
    const sorted = normalized.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      const dayA = Math.floor(dateA / 86400000);
      const dayB = Math.floor(dateB / 86400000);
      if (dayA !== dayB) return dayB - dayA;
      return b.score - a.score;
    });

    result[category] = sorted;
    console.log(`  \u2705 Final: ${sorted.length} articles`);
  }

  const outDir = join(__dirname, '..', 'public', 'data');
  mkdirSync(outDir, { recursive: true });

  const output = {
    generatedAt: new Date().toISOString(),
    categories: result,
  };

  const outPath = join(outDir, 'feeds.json');
  writeFileSync(outPath, JSON.stringify(output));
  console.log(`\n\u2705 Written to ${outPath}`);

  for (const cat of CATEGORIES) {
    const sources = new Set(result[cat].map(a => a.source));
    console.log(`  ${cat}: ${result[cat].length} articles from [${[...sources].join(', ')}]`);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
