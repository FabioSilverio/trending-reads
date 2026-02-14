import { useState, useEffect } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [input, setInput] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => onChange(input), 300);
    return () => clearTimeout(timer);
  }, [input, onChange]);

  useEffect(() => {
    setInput(value);
  }, [value]);

  return (
    <div className="search-bar">
      <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        placeholder="Buscar artigos..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="search-input"
      />
      {input && (
        <button className="search-clear" onClick={() => setInput('')} aria-label="Limpar busca">
          &times;
        </button>
      )}
    </div>
  );
}
