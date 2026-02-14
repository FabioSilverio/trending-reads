import type { Category } from '../types/article';
import { CATEGORY_LABELS } from '../config/feedSources';

const CATEGORIES: { key: Category; icon: string; desc: string }[] = [
  { key: 'filosofia', icon: '🏛️', desc: 'Ética, existencialismo, pensamento crítico' },
  { key: 'entretenimento', icon: '🎬', desc: 'Cinema, livros, cultura pop, música' },
  { key: 'tecnologia', icon: '💻', desc: 'Programação, IA, startups, gadgets' },
  { key: 'ciencia', icon: '🔬', desc: 'Física, biologia, espaço, descobertas' },
];

interface LandingPageProps {
  onSelect: (category: Category) => void;
}

export function LandingPage({ onSelect }: LandingPageProps) {
  return (
    <div className="landing">
      <div className="landing-hero">
        <h1 className="landing-title">Trending Reads</h1>
        <p className="landing-subtitle">
          Artigos longos e essays populares da internet, organizados por categoria.
        </p>
      </div>
      <div className="landing-grid">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className="landing-card"
            onClick={() => onSelect(cat.key)}
          >
            <span className="landing-card-icon">{cat.icon}</span>
            <span className="landing-card-title">{CATEGORY_LABELS[cat.key]}</span>
            <span className="landing-card-desc">{cat.desc}</span>
          </button>
        ))}
      </div>
      <p className="landing-footer">
        Fontes: Hacker News, Aeon, Wired, Nature, Ars Technica, Reddit e mais
      </p>
    </div>
  );
}
