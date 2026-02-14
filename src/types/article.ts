export type Category = 'filosofia' | 'entretenimento' | 'tecnologia' | 'ciencia';

export interface Article {
  id: string;
  title: string;
  url: string;
  source: string;
  category: Category;
  score: number;
  description?: string;
  publishedAt?: string;
  thumbnail?: string;
}

export interface FeedSource {
  name: string;
  url: string;
  type: 'rss' | 'reddit' | 'hackernews';
  category: Category;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
