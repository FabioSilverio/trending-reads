import type { Article } from '../types/article';

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'agora';
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  const weeks = Math.floor(days / 7);
  return `${weeks}sem atrás`;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'var(--score-high)';
  if (score >= 40) return 'var(--score-mid)';
  return 'var(--score-low)';
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer" className="article-card">
      <div className="card-header">
        <span className="card-source">{article.source}</span>
        <span className="card-score" style={{ backgroundColor: getScoreColor(article.score) }}>
          {article.score}
        </span>
      </div>
      <h3 className="card-title">{article.title}</h3>
      {article.description && (
        <p className="card-description">{article.description}</p>
      )}
      <div className="card-footer">
        <span className="card-domain">{getDomain(article.url)}</span>
        <span className="card-time">{timeAgo(article.publishedAt)}</span>
      </div>
    </a>
  );
}
