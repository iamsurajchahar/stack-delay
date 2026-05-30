import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, GitFork, X } from 'lucide-react';
import { clsx } from 'clsx';
import apiClient from '../../api/client';

interface SearchResult {
  type: 'repo' | 'package';
  // repo fields
  id?: string;
  name?: string;
  score?: number;
  grade?: string;
  // package fields
  packageName?: string;
  ecosystem?: string;
  version?: string;
  repos?: Array<{ repoId: string; repoName: string }>;
}

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/search', { params: { q: query } });
        const r = data.results ?? data ?? [];
        setResults(r);
        setOpen(r.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    if (result.type === 'repo' && result.id) {
      navigate(`/repos/${result.id}`);
    } else if (result.type === 'package' && result.repos?.[0]) {
      navigate(`/repos/${result.repos[0].repoId}`);
    }
  };

  return (
    <div className="relative hidden sm:block">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search packages & repos... (Ctrl+K)"
        className="input w-48 pl-9 pr-8 lg:w-80"
      />
      {query && (
        <button onClick={() => { setQuery(''); setOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[320px] max-h-[400px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            {loading && <p className="px-4 py-3 text-sm text-gray-500">Searching...</p>}
            {!loading && results.length === 0 && <p className="px-4 py-3 text-sm text-gray-500">No results found</p>}
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => handleSelect(r)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                {r.type === 'repo' ? (
                  <>
                    <GitFork className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{r.name}</p>
                      <p className="text-xs text-gray-500">Repository {r.grade ? `· Grade ${r.grade}` : ''}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Package className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{r.packageName} <span className="text-xs text-gray-400">{r.version}</span></p>
                      <p className="text-xs text-gray-500">{r.ecosystem} · Found in {r.repos?.map(rr => rr.repoName).join(', ')}</p>
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
