import type { Category, FeedSource } from '../types/article';

export const CATEGORY_LABELS: Record<Category, string> = {
  filosofia: 'Filosofia',
  entretenimento: 'Entretenimento',
  tecnologia: 'Tecnologia',
  ciencia: 'Ciência',
};

export const HN_SEARCH_TERMS: Record<Category, string[]> = {
  filosofia: ['philosophy', 'ethics', 'stoicism'],
  entretenimento: ['film essay', 'book review', 'culture'],
  tecnologia: ['programming', 'software engineering', 'AI'],
  ciencia: ['science', 'physics', 'neuroscience'],
};

// All feeds (RSS + Reddit RSS) unified — fetched via rss2json
export const RSS_SOURCES: FeedSource[] = [
  // ===== FILOSOFIA =====
  { name: 'Aeon', url: 'https://aeon.co/feed.rss', type: 'rss', category: 'filosofia' },
  { name: 'The Marginalian', url: 'https://www.themarginalian.org/feed/', type: 'rss', category: 'filosofia' },
  { name: 'Daily Nous', url: 'https://dailynous.com/feed/', type: 'rss', category: 'filosofia' },
  { name: 'IAI News', url: 'https://iai.tv/rss/articles', type: 'rss', category: 'filosofia' },
  { name: 'r/philosophy', url: 'https://www.reddit.com/r/philosophy/top/.rss?t=week', type: 'rss', category: 'filosofia' },

  // ===== ENTRETENIMENTO =====
  { name: 'Longreads', url: 'https://longreads.com/feed/', type: 'rss', category: 'entretenimento' },
  { name: 'The Atlantic - Culture', url: 'https://www.theatlantic.com/feed/channel/entertainment/', type: 'rss', category: 'entretenimento' },
  { name: 'Literary Hub', url: 'https://lithub.com/feed/', type: 'rss', category: 'entretenimento' },
  { name: 'The New Yorker - Culture', url: 'https://www.newyorker.com/feed/culture', type: 'rss', category: 'entretenimento' },
  { name: 'r/TrueFilm', url: 'https://www.reddit.com/r/TrueFilm/top/.rss?t=week', type: 'rss', category: 'entretenimento' },

  // ===== TECNOLOGIA =====
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', type: 'rss', category: 'tecnologia' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', type: 'rss', category: 'tecnologia' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', type: 'rss', category: 'tecnologia' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', type: 'rss', category: 'tecnologia' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', type: 'rss', category: 'tecnologia' },
  { name: 'r/programming', url: 'https://www.reddit.com/r/programming/top/.rss?t=week', type: 'rss', category: 'tecnologia' },

  // ===== CIÊNCIA =====
  { name: 'Quanta Magazine', url: 'https://api.quantamagazine.org/feed/', type: 'rss', category: 'ciencia' },
  { name: 'Nature News', url: 'https://www.nature.com/nature.rss', type: 'rss', category: 'ciencia' },
  { name: 'Science Daily', url: 'https://www.sciencedaily.com/rss/all.xml', type: 'rss', category: 'ciencia' },
  { name: 'Phys.org', url: 'https://phys.org/rss-feed/', type: 'rss', category: 'ciencia' },
  { name: 'New Scientist', url: 'https://www.newscientist.com/feed/home/', type: 'rss', category: 'ciencia' },
  { name: 'r/science', url: 'https://www.reddit.com/r/science/top/.rss?t=week', type: 'rss', category: 'ciencia' },
];

export const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
