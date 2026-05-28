import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDependencyScores } from '../../hooks/useScores';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { getGradeBgColor, getScoreColor } from '../../utils/scoreColors';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { EmptyState } from '../shared/EmptyState';
import { Ecosystem, ECOSYSTEM_DISPLAY_NAMES } from '@stack-decay/shared';

interface DependencyTableProps {
  repoId: string;
}

type SortField = 'name' | 'compositeScore' | 'maintenanceScore' | 'vulnerabilityScore' | 'eolScore' | 'ecosystem';

export function DependencyTable({ repoId }: DependencyTableProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('compositeScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [ecosystemFilter, setEcosystemFilter] = useState('');
  const limit = 20;

  const { data, isLoading } = useDependencyScores(repoId, {
    page,
    limit,
    sortBy,
    sortDir,
    search: search || undefined,
    ecosystem: ecosystemFilter || undefined,
  });

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  const columns: { key: SortField; label: string; align?: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'ecosystem', label: 'Ecosystem' },
    { key: 'compositeScore', label: 'Score', align: 'center' },
    { key: 'maintenanceScore', label: 'Maintenance', align: 'center' },
    { key: 'vulnerabilityScore', label: 'Vuln', align: 'center' },
    { key: 'eolScore', label: 'EOL', align: 'center' },
  ];

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="card">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search dependencies..."
            className="input pl-9"
          />
        </div>
        <select
          value={ecosystemFilter}
          onChange={(e) => {
            setEcosystemFilter(e.target.value);
            setPage(1);
          }}
          className="input w-auto"
        >
          <option value="">All Ecosystems</option>
          {Object.values(Ecosystem).map((eco) => (
            <option key={eco} value={eco}>
              {ECOSYSTEM_DISPLAY_NAMES[eco]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No dependencies found" description="No dependencies match your current filters." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={clsx(
                        'cursor-pointer whitespace-nowrap px-4 py-3 hover:text-gray-700',
                        col.align === 'center' && 'text-center',
                      )}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <SortIcon field={col.key} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((dep) => (
                  <tr
                    key={dep.id}
                    onClick={() => navigate(`/repos/${repoId}/deps/${dep.packageId}`)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{dep.name}</p>
                        <p className="text-xs text-gray-500">{dep.version}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge bg-gray-100 text-gray-600">{dep.ecosystem}</span>
                    </td>
                    <td className={clsx('px-4 py-3 text-center font-semibold', getScoreColor(dep.compositeScore))}>
                      {Math.round(dep.compositeScore)}
                    </td>
                    <td className={clsx('px-4 py-3 text-center', getScoreColor(dep.maintenanceScore))}>
                      {Math.round(dep.maintenanceScore)}
                    </td>
                    <td className={clsx('px-4 py-3 text-center', getScoreColor(dep.vulnerabilityScore))}>
                      {Math.round(dep.vulnerabilityScore)}
                    </td>
                    <td className={clsx('px-4 py-3 text-center', getScoreColor(dep.eolScore))}>
                      {Math.round(dep.eolScore)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx('badge', getGradeBgColor(dep.grade))}>
                        {dep.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * limit + 1}--{Math.min(page * limit, data.total)} of{' '}
                {data.total}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
