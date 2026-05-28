import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Star, GitBranch, Check } from 'lucide-react';
import { listAvailable } from '../../api/repos';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface Props {
  onSelect: (repos: any[]) => void;
}

export function RepoSelector({ onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: repos, isLoading } = useQuery({
    queryKey: ['available-repos'],
    queryFn: listAvailable,
  });

  const filtered = (repos || []).filter((repo: any) =>
    repo.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    repo.name?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleRepo = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r: any) => r.id?.toString() || r.github_repo_id?.toString())));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Select Repositories</h2>
        <p className="text-sm text-gray-500 mt-1">Choose which repos to monitor for stack health</p>
      </div>

      {/* Search + select all */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={selectAll}
          className="px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 border rounded-lg hover:bg-indigo-50"
        >
          {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Repo list */}
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="max-h-80 overflow-y-auto space-y-1 border rounded-lg">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500 p-4 text-center">No repositories found</p>
          ) : (
            filtered.map((repo: any) => {
              const id = repo.id?.toString() || repo.github_repo_id?.toString();
              const isSelected = selected.has(id);

              return (
                <button
                  key={id}
                  onClick={() => toggleRepo(id)}
                  className={`w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors ${
                    isSelected ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{repo.full_name || repo.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        {repo.language && <span>{repo.language}</span>}
                        {repo.stargazers_count != null && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3" /> {repo.stargazers_count}
                          </span>
                        )}
                        {repo.default_branch && (
                          <span className="flex items-center gap-0.5">
                            <GitBranch className="w-3 h-3" /> {repo.default_branch}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Continue button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => {
            const selectedRepos = (repos || []).filter((r: any) =>
              selected.has(r.id?.toString() || r.github_repo_id?.toString())
            );
            onSelect(selectedRepos);
          }}
          disabled={selected.size === 0}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          Continue with {selected.size} repo{selected.size !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
