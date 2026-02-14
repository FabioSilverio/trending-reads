import type { Category, FeedSource } from '../types/article';

export const CATEGORY_LABELS: Record<Category, string> = {
  filosofia: 'Filosofia',
  entretenimento: 'Entretenimento',
  tecnologia: 'Tecnologia',
  ciencia: 'Ciência',
};

export const HN_SEARCH_TERMS: Record<Category, string[]> = {
  filosofia: ['philosophy', 'ethics', 'existentialism', 'stoicism', 'moral philosophy'],
  entretenimento: ['film essay', 'book review', 'culture essay', 'longread entertainment'],
  tecnologia: ['programming', 'software engineering', 'AI', 'machine learning', 'startup'],
  ciencia: ['science', 'physics', 'biology', 'neuroscience', 'climate', 'research'],
};

export const REDDIT_SOURCES: FeedSource[] = [
  { name: 'r/philosophy', url: 'https://www.reddit.com/r/philosophy/top.json?t=week&limit=15', type: 'reddit', category: 'filosofia' },
  { name: 'r/PhilosophyofScience', url: 'https://www.reddit.com/r/PhilosophyofScience/top.json?t=week&limit=10', type: 'reddit', category: 'filosofia' },
  { name: 'r/TrueFilm', url: 'https://www.reddit.com/r/TrueFilm/top.json?t=week&limit=15', type: 'reddit', category: 'entretenimento' },
  { name: 'r/books', url: 'https://www.reddit.com/r/books/top.json?t=week&limit=10', type: 'reddit', category: 'entretenimento' },
  { name: 'r/technology', url: 'https://www.reddit.com/r/technology/top.json?t=week&limit=15', type: 'reddit', category: 'tecnologia' },
  { name: 'r/programming', url: 'https://www.reddit.com/r/programming/top.json?t=week&limit=15', type: 'reddit', category: 'tecnologia' },
  { name: 'r/science', url: 'https://www.reddit.com/r/science/top.json?t=week&limit=15', type: 'reddit', category: 'ciencia' },
  { name: 'r/EverythingScience', url: 'https://www.reddit.com/r/EverythingScience/top.json?t=week&limit=10', type: 'reddit', category: 'ciencia' },
];

export const RSS_SOURCES: FeedSource[] = [
  // Filosofia
  { name: 'Aeon', url: 'https://aeon.co/feed.rss', type: 'rss', category: 'filosofia' },
  { name: 'The Marginalian', url: 'https://www.themarginalian.org/feed/', type: 'rss', category: 'filosofia' },
  { name: 'Daily Nous', url: 'https://dailynous.com/feed/', type: 'rss', category: 'filosofia' },

  // Entretenimento
  { name: 'Longreads', url: 'https://longreads.com/feed/', type: 'rss', category: 'entretenimento' },
  { name: 'The Atlantic - Culture', url: 'https://www.theatlantic.com/feed/channel/entertainment/', type: 'rss', category: 'entretenimento' },
  { name: 'Literary Hub', url: 'https://lithub.com/feed/', type: 'rss', category: 'entretenimento' },

  // Tecnologia
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', type: 'rss', category: 'tecnologia' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', type: 'rss', category: 'tecnologia' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', type: 'rss', category: 'tecnologia' },

  // Ciência
  { name: 'Quanta Magazine', url: 'https://api.quantamagazine.org/feed/', type: 'rss', category: 'ciencia' },
  { name: 'Nature News', url: 'https://www.nature.com/nature.rss', type: 'rss', category: 'ciencia' },
  { name: 'Science Daily', url: 'https://www.sciencedaily.com/rss/all.xml', type: 'rss', category: 'ciencia' },
];

export const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
