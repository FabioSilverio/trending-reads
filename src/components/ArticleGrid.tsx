import type { Article } from '../types/article';
import { ArticleCard } from './ArticleCard';

interface ArticleGridProps {
  articles: Article[];
  loading: boolean;
  error: string | null;
}

export function ArticleGrid({ articles, loading, error }: ArticleGridProps) {
  if (error) {
    return (
      <div className="grid-message error">
        <p>{error}</p>
      </div>
    );
  }

  if (loading && articles.length === 0) {
    return (
      <div className="grid-message loading">
        <div className="spinner" />
        <p>Carregando artigos...</p>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="grid-message empty">
        <p>Nenhum artigo encontrado.</p>
      </div>
    );
  }

  return (
    <div className="article-grid">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
