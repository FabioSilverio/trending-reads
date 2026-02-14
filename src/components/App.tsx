import { useState, useCallback } from 'react';
import type { Category } from '../types/article';
import { SearchBar } from './SearchBar';
import { CategoryTabs } from './CategoryTabs';
import { ArticleGrid } from './ArticleGrid';
import { useArticles } from '../hooks/useArticles';

export function App() {
  const [category, setCategory] = useState<Category>('tecnologia');
  const [searchQuery, setSearchQuery] = useState('');
  const { articles, loading, error, refresh } = useArticles(category, searchQuery);

  const handleCategoryChange = useCallback((cat: Category) => {
    setCategory(cat);
    setSearchQuery('');
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="brand">
            <h1 className="app-title">Trending Reads</h1>
            <p className="app-subtitle">Artigos longos e essays populares</p>
          </div>
          <button className="refresh-btn" onClick={refresh} disabled={loading} title="Atualizar">
            <svg className={`refresh-icon ${loading ? 'spinning' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </button>
        </div>
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <CategoryTabs active={category} onChange={handleCategoryChange} />
      </header>
      <main className="app-main">
        <ArticleGrid articles={articles} loading={loading} error={error} />
      </main>
    </div>
  );
}
