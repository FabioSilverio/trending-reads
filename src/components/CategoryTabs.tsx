import type { Category } from '../types/article';
import { CATEGORY_LABELS } from '../config/feedSources';

const CATEGORIES: Category[] = ['filosofia', 'entretenimento', 'tecnologia', 'ciencia'];

const CATEGORY_ICONS: Record<Category, string> = {
  filosofia: '🏛️',
  entretenimento: '🎬',
  tecnologia: '💻',
  ciencia: '🔬',
};

interface CategoryTabsProps {
  active: Category;
  onChange: (category: Category) => void;
}

export function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <nav className="category-tabs">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          className={`category-tab ${active === cat ? 'active' : ''}`}
          onClick={() => onChange(cat)}
        >
          <span className="tab-icon">{CATEGORY_ICONS[cat]}</span>
          <span className="tab-label">{CATEGORY_LABELS[cat]}</span>
        </button>
      ))}
    </nav>
  );
}
